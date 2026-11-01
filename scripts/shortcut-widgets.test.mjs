import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = path => readFileSync(resolve(root, path), 'utf8');
const swift = read('ios/EinsatzWidget/ShortcutWidgets.swift');
const project = read('ios/App/App.xcodeproj/project.pbxproj');
const objects = new Map([...project.matchAll(/^\t\t([A-F0-9]{24})(?: \/\*[^\n]*?\*\/)? = (\{[^\n]*\};|\{\n[\s\S]*?^\t\t\};)/gm)]
  .map(([, id, body]) => [id, body]));
const list = (body, key) => body?.match(new RegExp(`\\b${key} = \\(([\\s\\S]*?)\\);`))?.[1].match(/\b[A-F0-9]{24}\b/g) ?? [];
const paths = ['/kontakte', '/objekte/', '/fahrtenbuch/neu'];

test('ShortcutWidgets.swift gehört zur Gruppe und Sources-Phase des EinsatzWidget-Targets', () => {
  const refs = [...objects].filter(([, body]) => /isa = PBXFileReference;/.test(body) && /\bpath = ShortcutWidgets\.swift;/.test(body));
  assert.equal(refs.length, 1);
  const [fileId] = refs[0];
  const group = [...objects.values()].find(body => /isa = PBXGroup;/.test(body) && /path = "?\.\.\/EinsatzWidget"?;/.test(body));
  assert.ok(list(group, 'children').includes(fileId));
  const builds = [...objects].filter(([, body]) => /isa = PBXBuildFile;/.test(body) && body.includes(`fileRef = ${fileId}`));
  assert.equal(builds.length, 1);
  const widget = [...objects.values()].find(body => /isa = PBXNativeTarget;/.test(body) && /\bname = EinsatzWidget;/.test(body));
  assert.ok(widget, 'EinsatzWidget-Target fehlt');
  const sources = list(widget, 'buildPhases').map(id => objects.get(id)).find(body => /isa = PBXSourcesBuildPhase;/.test(body));
  assert.ok(list(sources, 'files').includes(builds[0][0]));
});

test('Verknüpfungen verwenden die drei Pfade, Symbole und statische Timelines', () => {
  for (const path of paths) assert.ok(swift.includes(`path: "${path}"`), path);
  for (const symbol of ['person.2.fill', 'building.2.fill', 'car.fill']) assert.ok(swift.includes(`symbol: "${symbol}"`));
  for (const name of ['KontakteShortcutWidget', 'ObjekteShortcutWidget', 'FahrtShortcutWidget']) {
    assert.match(swift, new RegExp(`struct ${name}: Widget \\{[\\s\\S]*?StaticConfiguration\\([\\s\\S]*?\\.supportedFamilies\\(\\[\\.systemSmall, \\.accessoryCircular, \\.accessoryRectangular\\]\\)`));
  }
  assert.match(swift, /Timeline\(entries: \[ShortcutEntry\(date: Date\(\)\)\], policy: \.never\)/);
  assert.match(swift, /\.widgetURL\(deepLink\(path: definition.path\)\)/);
  assert.match(swift, /if #available\(iOS 17.0, \*\) \{[\s\S]*?\.containerBackground\(for: \.widget\)[\s\S]*?\} else \{\s*content.background\(Color\(\.systemBackground\)\)/);
});

test('Bundle enthält Status, Live Activity und Shortcuts in der gewünschten Reihenfolge', () => {
  const bundle = read('ios/EinsatzWidget/EinsatzWidgetBundle.swift');
  assert.deepEqual([...bundle.matchAll(/^\s+(\w+Widget)\(\)/gm)].map(([, name]) => name),
    ['EinsatzStatusWidget', 'EinsatzLiveActivityWidget', 'FahrtShortcutWidget', 'KontakteShortcutWidget', 'ObjekteShortcutWidget']);
});

const routers = '/home/johannes/projects/einsatzcockpit/app/routers';
test('Verknüpfungspfade existieren exakt als Backend-GET-Routen', {
  skip: !existsSync(routers) && 'Backend-Router-Verzeichnis fehlt',
}, t => {
  const routes = new Map();
  const scan = directory => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        scan(file);
      } else if (entry.name.endsWith('.py')) {
        const source = readFileSync(file, 'utf8');
        const prefixes = new Map([...source.matchAll(/\b(\w+)\s*=\s*APIRouter\(([^)]*)\)/g)]
          .map(([, name, args]) => [name, args.match(/\bprefix\s*=\s*["']([^"']*)["']/)?.[1] ?? '']));
        for (const [, router, path] of source.matchAll(/@(\w+)\.get\(\s*["']([^"']*)["']/g)) {
          if (prefixes.has(router)) routes.set(prefixes.get(router) + path, file);
        }
      }
    }
  };
  scan(routers);
  const missing = [];
  for (const path of paths) {
    if (routes.has(path)) t.diagnostic(`${path}: ${routes.get(path)}`);
    else missing.push(path);
  }
  assert.deepEqual(missing, [], `Keine exakte Backend-GET-Route für: ${missing.join(', ')}`);
});
