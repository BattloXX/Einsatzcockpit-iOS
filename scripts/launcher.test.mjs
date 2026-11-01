import { readFileSync, existsSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, sep } from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import { iosVersion, versionForBuild } from './ios-version.mjs';

const www = resolve(fileURLToPath(new URL('../www/', import.meta.url)));
const pages = Object.fromEntries(['index.html', 'about.html', 'offline.html']
  .map(name => [name, readFileSync(resolve(www, name), 'utf8')]));
const source = name => pages[name].match(/<script>([\s\S]*?)<\/script>/)[1];

function launcher({ stored = {}, offline = false, query = '', launchUrl } = {}) {
  const values = new Map(Object.entries(stored));
  const navigations = [];
  const elements = new Map();
  const Preferences = {
    async get({ key }) { return { value: values.get(key) ?? null }; },
    async set({ key, value }) { values.set(key, value); },
    async remove({ key }) { values.delete(key); },
  };
  const context = {
    URL, URLSearchParams, Date, navigator: { onLine: !offline },
    setTimeout() {}, // Bootstrap nicht automatisch ausführen; startApp gezielt testen.
    document: { getElementById(id) {
      if (!elements.has(id)) elements.set(id, { style: {}, textContent: '', disabled: false });
      return elements.get(id);
    } },
    window: { location: { search: query, replace: url => navigations.push(url) } },
  };
  vm.createContext(context);
  vm.runInContext(source('index.html'), context);
  context.window.Capacitor = { Plugins: {
    Preferences, App: { async getLaunchUrl() { return { url: launchUrl }; } },
  } };
  return { context, Preferences, values, navigations, elements };
}

test('Launcher und Infoseite enthalten keine entfernten nativen Funktionen', () => {
  for (const name of ['SmsGateway', 'gateway.html', 'DeviceKeepalive', 'AlarmChannel',
    'isGoogleBarcodeScannerModuleAvailable', 'installGoogleBarcodeScannerModule', 'PushNotifications',
    'el_gateway_url', 'el_gateway_token', 'pin_gateway_token', 'ensureBatteryOptimizationOff',
    'finishAccountLiveChoice', 'liveOptIn']) {
    assert.ok(!pages['index.html'].includes(name), name);
  }
  assert.doesNotMatch(pages['about.html'], /SmsGateway|AlarmChannel|update-check/);
  assert.ok(pages['index.html'].includes('SMS-Gateway wird in der iOS-App nicht unterstützt.'));
});

test('Alle lokalen src/href-Dateien existieren innerhalb von www', () => {
  for (const [name, html] of Object.entries(pages)) {
    const markup = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '').replace(/<!--[\s\S]*?-->/g, '');
    for (const [, ref] of markup.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/g)) {
      if (/^(?:https?:|data:|#|\/\/)/i.test(ref)) continue;
      assert.ok(!/^[a-z][a-z\d+.-]*:/i.test(ref), `${name}: unerwartete lokale Referenz ${ref}`);
      const path = resolve(www, decodeURIComponent(ref.split(/[?#]/)[0]).replace(/^\//, ''));
      assert.ok(path.startsWith(www + sep), ref);
      assert.ok(existsSync(path), `${name}: ${ref}`);
      assert.ok(realpathSync(path).startsWith(realpathSync(www) + sep), ref);
    }
    assert.match(html, /viewport-fit=cover/);
    for (const side of ['top', 'right', 'bottom', 'left']) assert.ok(html.includes(`env(safe-area-inset-${side})`));
  }
});

test('Markup-IDs sind eindeutig und alle direkten Referenzen existieren', () => {
  for (const [name, html] of Object.entries(pages)) {
    const markup = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '');
    const ids = [...markup.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
    assert.equal(new Set(ids).size, ids.length, name);
    for (const [, id] of html.matchAll(/getElementById\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      assert.ok(ids.includes(id), `${name}: ${id}`);
    }
  }
});

test('iOS-Version normalisiert CalVer, Tag und Paketversion', () => {
  for (const [input, output] of [['2026.11.01.2', '2026.11.1'], ['v2026.01.09', '2026.1.9'],
    ['1.02.003', '1.2.3'], ['2026.11.01', '2026.11.1']]) assert.equal(iosVersion(input), output);
  for (const value of ['1.2', '1.2.3-beta', '1..3', 'bad', '1.2.3.bad']) assert.throws(() => iosVersion(value));
  assert.equal(versionForBuild({ GITHUB_REF: 'refs/tags/v2027.02.03.4' }, '2026.11.01'), '2027.2.3');
  assert.equal(versionForBuild({ GITHUB_REF: 'refs/heads/main' }, '2026.11.01'), '2026.11.1');
});

test('Push bleibt null und URL-Helfer kann später FCM ergänzen', async () => {
  const { context } = launcher();
  assert.equal(await context.registerPushToken(), null);
  assert.equal(context.withFcmParam('https://einsatzcockpit.com/', null), 'https://einsatzcockpit.com/');
  assert.equal(context.withFcmParam('https://einsatzcockpit.com/?native=1', 'a+b'),
    'https://einsatzcockpit.com/?native=1&fcm_token=a%2Bb');
});

test('Offline-Start von Gerät und Account nutzt gecachte Root-URL ohne Query', async () => {
  for (const stored of [{ el_device_token: 'test' }, { el_used_account_login: '1', el_live_enabled: '1' }]) {
    const p = launcher({ stored, offline: true });
    await p.context.startApp();
    assert.deepEqual(p.navigations, ['https://einsatzcockpit.com/']);
    assert.equal(p.values.get('el_live_enabled'), '0');
  }
});

test('QR: reines Gateway ablehnen, kombiniertes Gerät ohne Gateway-Token anmelden', async () => {
  const p = launcher();
  await p.context.handleQrResult('https://einsatzcockpit.com/?mode=sms-gateway', p.Preferences);
  assert.equal(p.elements.get('error').textContent, 'SMS-Gateway wird in der iOS-App nicht unterstützt.');
  assert.equal(p.elements.get('error').style.display, 'block');
  assert.equal(p.navigations.length, 0);
  assert.equal(p.values.size, 0);
  await p.context.handleQrResult('https://einsatzcockpit.com/?mode=unit%2Bsms-gateway&token=a%2Bb', p.Preferences);
  assert.equal(p.values.get('el_device_token'), 'a+b');
  assert.deepEqual(p.navigations, ['https://einsatzcockpit.com/geraet-login?token=a%2Bb&native=1']);
});

test('QR lehnt fremde Origins und eingebettete Zugangsdaten ab', async () => {
  for (const url of ['javascript:alert(1)', 'https://example.com/?token=a',
    'https://einsatzcockpit.com:444/?token=a', 'https://user@einsatzcockpit.com/?token=a']) {
    const p = launcher();
    await p.context.handleQrResult(url, p.Preferences);
    assert.equal(p.values.size, 0);
    assert.equal(p.navigations.length, 0);
  }
});

test('QR-Scanner fragt Kamera vor Scan an und bleibt bei Ablehnung bedienbar', async () => {
  const p = launcher();
  const calls = [];
  p.context.window.Capacitor.Plugins.BarcodeScanner = {
    async requestPermissions() { calls.push('permission'); return { camera: 'granted' }; },
    async scan() { calls.push('scan'); return { barcodes: [{ rawValue: 'https://einsatzcockpit.com/?token=unit' }] }; },
  };
  await p.context.startScan();
  assert.deepEqual(calls, ['permission', 'scan']);
  assert.equal(p.values.get('el_device_token'), 'unit');
  p.context.window.Capacitor.Plugins.BarcodeScanner.requestPermissions = async () => ({ camera: 'denied' });
  await p.context.startScan();
  assert.equal(calls.length, 2);
  assert.equal(p.elements.get('scanBtn').disabled, false);
});

test('PIN und Logout setzen Zugangsdaten zurück, Launch-URL bleibt erhalten', async () => {
  const p = launcher({ query: '?pin_device_token=a%2Bb', stored: { ec_device_access_invalid: '1' } });
  await p.context.startApp();
  assert.equal(p.values.get('el_device_token'), 'a+b');
  assert.equal(p.values.has('ec_device_access_invalid'), false);
  assert.deepEqual(p.navigations, ['https://einsatzcockpit.com/geraet-login?token=a%2Bb&native=1']);
  const logout = launcher({ query: '?native_logout=1', stored: {
    el_device_token: 'a', ec_device_access_invalid: '1', el_used_account_login: '1',
  }, launchUrl: 'https://einsatzcockpit.com/einsatz/1' });
  await logout.context.startApp();
  for (const key of ['el_device_token', 'ec_device_access_invalid', 'el_used_account_login']) assert.ok(!logout.values.has(key));
  assert.deepEqual(logout.navigations, ['https://einsatzcockpit.com/logout']);
  const launch = launcher({ launchUrl: 'https://einsatzcockpit.com/einsatz/1?tab=karte#punkt' });
  await launch.context.startApp();
  assert.deepEqual(launch.navigations, ['https://einsatzcockpit.com/einsatz/1?tab=karte#punkt']);
});

test('Persönlicher Login öffnet direkt das Login ohne Live-Abfrage', async () => {
  const p = launcher();
  await p.context.openAccountLogin();
  assert.equal(p.values.get('el_live_enabled'), '0');
  assert.equal(p.values.get('el_used_account_login'), '1');
  assert.deepEqual(p.navigations, ['https://einsatzcockpit.com/login?native=1']);
});

test('Infoseite zeigt nur Tokenstatus und setzt die drei Anmeldeschlüssel zurück', async () => {
  const p = launcher({ stored: { el_device_token: 'SECRET-TEST-TOKEN', ec_device_access_invalid: '1', el_used_account_login: '1' } });
  p.context.window.Capacitor.getPlatform = () => 'ios';
  p.context.window.Capacitor.Plugins.App.getInfo = async () => ({ version: '2026.11.1', build: '42' });
  vm.runInContext(source('about.html'), p.context);
  await p.context.loadInfo();
  assert.equal(p.elements.get('deviceTokenStatus').textContent, 'Ja');
  assert.equal(p.elements.get('appVersion').textContent, '2026.11.1 (42)');
  assert.ok([...p.elements.values()].every(el => !el.textContent.includes('SECRET-TEST-TOKEN')));
  await p.context.resetDevice();
  assert.equal(p.values.size, 0);
  assert.deepEqual(p.navigations, ['https://einsatzcockpit.com/logout']);
});
