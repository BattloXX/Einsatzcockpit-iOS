import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { installGoogleServiceInfo } from './install-google-service-info.mjs';

test('Firebase-Plist bleibt optional und wird idempotent als App-Ressource eingebunden', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'einsatzcockpit-firebase-'));
  try {
    mkdirSync(resolve(root, 'ios/App/App'), { recursive: true });
    mkdirSync(resolve(root, 'ios/App/App.xcodeproj'));
    const project = resolve(root, 'ios/App/App.xcodeproj/project.pbxproj');
    const original = readFileSync(new URL('../ios/App/App.xcodeproj/project.pbxproj', import.meta.url), 'utf8');
    assert.ok(!original.includes('GoogleService-Info.plist'));
    writeFileSync(project, original);
    assert.equal(installGoogleServiceInfo(root), false);
    assert.equal(readFileSync(project, 'utf8'), original);
    const source = resolve(root, 'dummy.plist');
    const dummy = '<?xml version="1.0"?><plist version="1.0"><dict><key>TEST_ONLY</key><true/></dict></plist>';
    writeFileSync(source, dummy);
    assert.equal(installGoogleServiceInfo(root, source), true);
    const installed = readFileSync(project, 'utf8');
    assert.equal(readFileSync(resolve(root, 'ios/App/App/GoogleService-Info.plist'), 'utf8'), dummy);
    assert.match(installed, /isa = PBXFileReference;[^\n]*path = "GoogleService-Info.plist"/);
    assert.match(installed, /isa = PBXBuildFile; fileRef = EC0000000000000000000002/);
    assert.match(installed, /isa = PBXResourcesBuildPhase;[\s\S]*?files = \(\s*EC0000000000000000000003/);
    assert.match(installed, /504EC3061FED79650016851F \/\* App \*\/ = \{[\s\S]*?children = \(\s*EC0000000000000000000002/);
    assert.equal(installGoogleServiceInfo(root), true);
    assert.equal(installGoogleServiceInfo(root, source), true);
    assert.equal(readFileSync(project, 'utf8'), installed);
    assert.ok(existsSync(source));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
