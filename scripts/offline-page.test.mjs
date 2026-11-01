import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

// Aus der Android-Referenz übernommen, ohne native Kontakte-/Objekt-Funktionen.
function page(retry) {
  const listeners = {};
  const navigations = [];
  const location = { hash: '#retry=' + encodeURIComponent(retry),
    replace: url => navigations.push(url) };
  const html = readFileSync(new URL('../www/offline.html', import.meta.url), 'utf8');
  vm.runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1], {
    URL, URLSearchParams, location,
    document: { getElementById: id => ({ addEventListener: (_, callback) => { listeners[id] = callback; } }) },
  });
  return { listeners, navigations, html };
}

test('Retry lädt letzte erlaubte URL einschließlich Query und Fragment', () => {
  for (const host of ['einsatzcockpit.com', 'www.einsatzcockpit.com']) {
    const url = `https://${host}/objekte/12?tab=gefahren#details`;
    const p = page(url);
    p.listeners.retry();
    assert.deepEqual(p.navigations, [url]);
  }
});

test('Retry ignoriert fremde, aktive und nicht App-bound URLs', () => {
  for (const url of ['', 'https://example.com/', 'javascript:alert(1)',
    'https://einsatzcockpit.com.example.com/', 'http://einsatzcockpit.com/',
    'https://fremd.einsatzcockpit.com/', 'https://user:secret@einsatzcockpit.com/']) {
    const p = page(url);
    p.listeners.retry();
    assert.deepEqual(p.navigations, ['https://einsatzcockpit.com/']);
  }
});

test('Offline-Seite verspricht keinen nativen Objekt-Cache', () => {
  const { html } = page('');
  assert.doesNotMatch(html, /DeviceKeepalive|Objekte \(offline\)|Android/);
  assert.match(html, /Web-Cache/);
  assert.match(html, /viewport-fit=cover/);
});
