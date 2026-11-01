import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const project = read('ios/App/App.xcodeproj/project.pbxproj');
const definitions = [...project.matchAll(/^\t\t([A-F0-9]{24})(?: \/\*[^\n]*?\*\/)? = (\{[^\n]*\};|\{\n[\s\S]*?^\t\t\};)/gm)];
const objects = new Map(definitions.map(([, id, body]) => [id, body]));
const ids = text => text.match(/\b[A-F0-9]{24}\b/g) ?? [];
const list = (body, key) => ids(body.match(new RegExp(`${key} = \\(([\\s\\S]*?)\\);`))?.[1] ?? '');
const ref = (body, key) => body.match(new RegExp(`${key} = ([A-F0-9]{24})`))?.[1];
const attributes = read('ios/Shared/EinsatzActivityAttributes.swift');
const manager = read('ios/App/App/LiveActivityManager.swift');
const widget = read('ios/EinsatzWidget/EinsatzLiveActivity.swift');

test('Live-Activity-Dateien haben eindeutige Referenzen und die richtigen Sources-Targets', () => {
  assert.equal(objects.size, definitions.length, 'Doppelte Objekt-ID');
  for (const id of ids(project)) assert.ok(objects.has(id), `Referenz ohne Objekt: ${id}`);
  const sources = name => {
    const target = [...objects.values()].find(body => body.includes('isa = PBXNativeTarget;') && body.includes(`name = ${name};`));
    assert.ok(target);
    const phase = list(target, 'buildPhases').map(id => objects.get(id)).find(body => body.includes('isa = PBXSourcesBuildPhase;'));
    return list(phase, 'files').map(id => ref(objects.get(id), 'fileRef'));
  };
  const app = sources('App');
  const extension = sources('EinsatzWidget');
  for (const [path, targets] of [
    ['../Shared/EinsatzActivityAttributes.swift', [app, extension]],
    ['LiveActivityManager.swift', [app]],
    ['EinsatzLiveActivity.swift', [extension]],
  ]) {
    const refs = [...objects].filter(([, body]) => body.includes('isa = PBXFileReference;') && body.includes(`path = ${path};`));
    assert.equal(refs.length, 1, path);
    const id = refs[0][0];
    for (const target of [app, extension]) assert.equal(target.filter(value => value === id).length, targets.includes(target) ? 1 : 0, path);
    const builds = [...objects.values()].filter(body => body.includes('isa = PBXBuildFile;') && ref(body, 'fileRef') === id);
    assert.equal(builds.length, targets.length);
  }
});

test('Plist, Widget-Bundle und Payload-Vertrag sind eingebunden', () => {
  const plist = JSON.parse(execFileSync('python3', ['-c', 'import json, plistlib, sys; print(json.dumps(plistlib.load(open(sys.argv[1], "rb"))))', new URL('../ios/App/App/Info.plist', import.meta.url).pathname], { encoding: 'utf8' }));
  assert.equal(plist.NSSupportsLiveActivities, true);
  assert.equal(plist.NSSupportsLiveActivitiesFrequentUpdates, true);
  assert.ok(read('ios/EinsatzWidget/EinsatzWidgetBundle.swift').includes('EinsatzLiveActivityWidget()'));
  for (const key of ['alarm_code', 'address', 'phase_index', 'phase_count', 'phase_label', 'started_at', 'unit_count', 'is_exercise', 'ended', 'incident_id', 'url']) assert.ok(attributes.includes(`"${key}"`), key);
  assert.match(attributes, /struct EinsatzActivityAttributes: ActivityAttributes/);
  assert.match(attributes, /var startedAt: Double/);
  assert.equal((attributes.match(/init\(from decoder: Decoder\)/g) ?? []).length, 2);
  assert.ok(manager.includes('/api/v1/device/live-activity-token'));
  for (const swift of [attributes, manager, widget]) assert.ok(!swift.includes('http://'));
});

test('Availability, Logout und sichere Transportgrenzen bleiben erhalten', () => {
  for (const swift of [attributes, manager, widget]) assert.ok(swift.includes('@available(iOS 16.2, *)'));
  assert.match(manager, /if #available\(iOS 17.2, \*\)/);
  assert.match(read('ios/App/App/AppDelegate.swift'), /if #available\(iOS 16.2, \*\) \{ LiveActivityManager.start\(\) \}/);
  assert.match(read('ios/App/App/SharedCredentialSync.swift'), /if #available\(iOS 16.2, \*\) \{ LiveActivityManager.endAll\(\) \}/);
  for (const value of ['completionHandler(nil)', 'timeoutIntervalForRequest = 15', 'CapacitorStorage.el_device_token', 'CapacitorStorage.el_base_url', '"https"', '".einsatzcockpit.com"', 'generation == epoch', 'makeState(from duty: LiveDutyState, now: Date)']) assert.ok(manager.includes(value), value);
});
