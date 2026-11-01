import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const project = read('ios/App/App.xcodeproj/project.pbxproj');
const sync = read('ios/App/App/SharedCredentialSync.swift');
const keys = read('ios/Shared/SharedKeys.swift');
const delegate = read('ios/App/App/AppDelegate.swift');
const entitlements = read('ios/App/App/App.entitlements');

// Tokenize comments and quoted strings separately so braces in shell scripts do
// not affect the OpenStep structure. Unterminated quotes/comments must fail too.
function tokens(source) {
  const lexer = /\s+|\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\[\s\S]|[^"\\])*"|[^\s{}()=;,"/]+|[{}()=;,/]/y;
  const result = [];
  let offset = 0;
  while (offset < source.length) {
    lexer.lastIndex = offset;
    const match = lexer.exec(source);
    assert.ok(match, `Ungültiges Token oder offene Anführungszeichen bei ${offset}`);
    const value = match[0];
    assert.ok(!source.startsWith('/*', offset) || value.endsWith('*/'), 'Offener Kommentar');
    offset = lexer.lastIndex;
    if (!/^\s|^\/\*|^\/\//.test(value)) result.push(value);
  }
  return result;
}

const projectTokens = tokens(project);
// Object definitions have exactly two tabs in this project; nested dictionaries
// remain part of their enclosing object.
const definitions = [...project.matchAll(/^\t\t([A-F0-9]{24})(?: \/\*[^\n]*?\*\/)? = (\{[^\n]*\};|\{\n[\s\S]*?^\t\t\};)/gm)];
const objects = new Map(definitions.map(([, id, body]) => [id, body]));
const ids = value => value.match(/\b[A-F0-9]{24}\b/g) ?? [];

test('Projekt hat balancierte Klammern/Strings und eindeutige EC-Objekt-IDs', () => {
  const stack = [];
  for (const token of projectTokens) {
    if (token === '{' || token === '(') stack.push(token);
    if (token === '}' || token === ')') {
      assert.equal(stack.pop(), token === '}' ? '{' : '(');
    }
  }
  assert.equal(stack.length, 0);
  const defined = definitions.map(([, id]) => id).filter(id => id.startsWith('EC000'));
  assert.ok(defined.length >= 6);
  assert.equal(new Set(defined).size, defined.length, 'Doppelte EC-Objektdefinition');
  for (const id of projectTokens.filter(token => token.startsWith('EC000'))) {
    assert.match(id, /^[A-F0-9]{24}$/);
    assert.ok(defined.includes(id), `EC-Referenz ohne Definition: ${id}`);
  }
});

test('Beide Swift-Dateien gehören zur Sources-Phase des App-Targets', () => {
  const app = [...objects.values()].find(body => /isa = PBXNativeTarget;/.test(body) && /\bname = App;/.test(body));
  assert.ok(app, 'App-Target fehlt');
  const phases = ids(app.match(/buildPhases = \(([\s\S]*?)\);/)?.[1] ?? '');
  const sources = phases.map(id => objects.get(id)).find(body => /isa = PBXSourcesBuildPhase;/.test(body));
  assert.ok(sources, 'Sources-Phase fehlt');
  const sourceIds = ids(sources.match(/files = \(([\s\S]*?)\);/)?.[1] ?? '');
  for (const name of ['SharedCredentialSync.swift', 'SharedKeys.swift']) {
    const references = [...objects].filter(([, body]) => /isa = PBXFileReference;/.test(body) && (body.includes(`/${name};`) || body.includes(`path = ${name};`)));
    assert.equal(references.length, 1, `${name}: genau eine Dateireferenz`);
    const [fileId, reference] = references[0];
    const builds = [...objects].filter(([, body]) => /isa = PBXBuildFile;/.test(body) && body.includes(`fileRef = ${fileId}`));
    assert.equal(builds.length, 1, `${name}: genau ein PBXBuildFile`);
    assert.ok(sourceIds.includes(builds[0][0]), `${name}: nicht in App-Sources`);
    if (name === 'SharedKeys.swift') {
      assert.match(reference, /path = \.\.\/Shared\/SharedKeys.swift; sourceTree = SOURCE_ROOT;/);
      const path = reference.match(/path = ([^;]+);/)[1];
      assert.equal(read(`ios/App/${path}`), keys);
      assert.equal(resolve('ios/App', path), resolve('ios/Shared/SharedKeys.swift'));
    } else {
      const group = objects.get('504EC3061FED79650016851F');
      assert.ok(ids(group.match(/children = \(([\s\S]*?)\);/)[1]).includes(fileId));
      assert.match(reference, /path = SharedCredentialSync.swift; sourceTree = "<group>";/);
    }
  }
});

test('App Group, Capacitor-Schlüssel und Lifecycle-Sync sind eingebunden', () => {
  assert.match(entitlements, /<key>com.apple.security.application-groups<\/key>\s*<array>\s*<string>group.cloud.einsatzleiter.app<\/string>\s*<\/array>/);
  assert.match(keys, /static let groupId = "group.cloud.einsatzleiter.app"/);
  for (const key of ['baseUrl', 'deviceToken', 'accessInvalid', 'updatedAt', 'dutyState']) {
    assert.match(keys, new RegExp(`static let ${key} = "[^"]+"`));
    assert.ok(sync.includes(`SharedKeys.${key}`));
  }
  assert.match(keys, /static let dutyState = "widget.dutyState"/);
  for (const key of ['el_device_token', 'el_base_url', 'ec_device_access_invalid']) {
    assert.ok(sync.includes(`"CapacitorStorage.${key}"`));
  }
  assert.match(delegate, /didFinishLaunchingWithOptions[^\{]*\{\s*SharedCredentialSync.start\(\)/);
  for (const notification of ['didBecomeActiveNotification', 'didEnterBackgroundNotification']) {
    assert.ok(sync.includes(`UIApplication.${notification}`));
  }
  assert.match(sync, /shared.removeObject\(forKey: SharedKeys.dutyState\)/);
  assert.match(sync, /if changed \{[\s\S]*?WidgetCenter.shared.reloadAllTimelines\(\)/);
});
