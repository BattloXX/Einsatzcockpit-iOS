import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = path => readFileSync(resolve(root, path), 'utf8');
const project = read('ios/App/App.xcodeproj/project.pbxproj');
// Only top-level object definitions have two tabs. Nested TargetAttributes
// dictionaries reference target IDs but do not define additional objects.
const definitions = [...project.matchAll(/^\t\t([A-F0-9]{24})(?: \/\*[^\n]*?\*\/)? = (\{[^\n]*\};|\{\n[\s\S]*?^\t\t\};)/gm)];
const objects = new Map(definitions.map(([, id, body]) => [id, body]));
const ids = value => value.match(/\b[A-F0-9]{24}\b/g) ?? [];
const list = (body, key) => ids(body.match(new RegExp(`\\b${key} = \\(([\\s\\S]*?)\\);`))?.[1] ?? '');
const ref = (body, key) => body.match(new RegExp(`\\b${key} = ([A-F0-9]{24})`))?.[1];
const setting = (body, key) => body.match(new RegExp(`\\b${key} = ("[^"\\n]*"|[^;\\n]+);`))?.[1].replace(/^"|"$/g, '');
const target = name => [...objects].find(([, body]) => /isa = PBXNativeTarget;/.test(body) && setting(body, 'name') === name);
const [appId, app] = target('App') ?? [];
const [widgetId, widget] = target('EinsatzWidget') ?? [];
const configurations = body => list(objects.get(ref(body, 'buildConfigurationList')), 'buildConfigurations').map(id => objects.get(id));
const phase = (body, isa) => list(body, 'buildPhases').map(id => objects.get(id)).find(value => value.includes(`isa = ${isa};`));

test('OpenStep-Klammern, Strings und EC-Objektverweise sind gültig', () => {
  // Lex quoted shell scripts atomically; braces and escaped quotes inside them
  // must not change the OpenStep nesting depth.
  const lexer = /\s+|\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\[\s\S]|[^"\\])*"|[^\s{}()=;,"/]+|[{}()=;,/]/y;
  const stack = [];
  const tokens = [];
  let offset = 0;
  while (offset < project.length) {
    lexer.lastIndex = offset;
    const match = lexer.exec(project);
    assert.ok(match, `Offener String oder ungültiges Token bei ${offset}`);
    const token = match[0];
    assert.ok(!project.startsWith('/*', offset) || token.endsWith('*/'), 'Offener Kommentar');
    offset = lexer.lastIndex;
    if (/^\s|^\/\*|^\/\//.test(token)) continue;
    tokens.push(token);
    if (token === '{' || token === '(') stack.push(token);
    if (token === '}' || token === ')') assert.equal(stack.pop(), token === '}' ? '{' : '(');
  }
  assert.equal(stack.length, 0);
  const ecIds = definitions.map(([, id]) => id).filter(id => id.startsWith('EC000'));
  assert.equal(new Set(ecIds).size, ecIds.length, 'Doppelte EC-Objektdefinition');
  for (const token of tokens.filter(value => value.startsWith('EC000'))) {
    assert.match(token, /^EC[0-9A-F]{22}$/);
    assert.ok(objects.has(token), `Nicht definiertes Objekt: ${token}`);
  }
  const added = ecIds.filter(id => BigInt(`0x${id}`) >= BigInt('0xEC0000000000000000000100') && BigInt(`0x${id}`) < BigInt('0xEC0000000000000000000200')).sort();
  assert.ok(added.length > 0);
  added.forEach((id, index) => assert.equal(BigInt(`0x${id}`), BigInt('0xEC0000000000000000000100') + BigInt(index)));
});

test('App baut und bettet EinsatzWidget vor dem CocoaPods-Skript ein', () => {
  assert.ok(appId, 'App-Target fehlt');
  assert.ok(widgetId, 'EinsatzWidget-Target fehlt');
  assert.equal(setting(widget, 'productType'), 'com.apple.product-type.app-extension');
  const productId = ref(widget, 'productReference');
  const product = objects.get(productId);
  assert.equal(setting(product, 'explicitFileType'), 'wrapper.app-extension');
  assert.equal(setting(product, 'includeInIndex'), '0');
  assert.equal(setting(product, 'path'), 'EinsatzWidget.appex');
  assert.equal(setting(product, 'sourceTree'), 'BUILT_PRODUCTS_DIR');
  const projectBody = [...objects.values()].find(body => /isa = PBXProject;/.test(body));
  const projectId = [...objects].find(([, body]) => body === projectBody)[0];
  assert.ok(list(projectBody, 'targets').includes(widgetId));
  assert.match(projectBody, new RegExp(`${widgetId} = \\{\\s*CreatedOnToolsVersion = [^;]+;`));
  assert.ok(list(objects.get(ref(projectBody, 'productRefGroup')), 'children').includes(productId));
  const dependency = list(app, 'dependencies').map(id => objects.get(id)).find(body => ref(body, 'target') === widgetId);
  assert.ok(dependency, 'Target-Abhängigkeit fehlt');
  assert.match(dependency, /isa = PBXTargetDependency;/);
  const proxy = objects.get(ref(dependency, 'targetProxy'));
  assert.match(proxy, /isa = PBXContainerItemProxy;/);
  assert.equal(ref(proxy, 'containerPortal'), projectId);
  assert.equal(setting(proxy, 'proxyType'), '1');
  assert.equal(ref(proxy, 'remoteGlobalIDString'), widgetId);
  assert.equal(setting(proxy, 'remoteInfo'), 'EinsatzWidget');
  const phases = list(app, 'buildPhases').map(id => objects.get(id));
  const embedIndex = phases.findIndex(body => setting(body, 'name') === 'Embed Foundation Extensions');
  const podsIndex = phases.findIndex(body => setting(body, 'name') === '[CP] Embed Pods Frameworks');
  const resourcesIndex = phases.findIndex(body => /isa = PBXResourcesBuildPhase;/.test(body));
  assert.ok(resourcesIndex < embedIndex && embedIndex < podsIndex, 'Embed-Phase muss nach Resources und vor Pods liegen');
  const embed = phases[embedIndex];
  assert.match(embed, /isa = PBXCopyFilesBuildPhase;/);
  assert.equal(setting(embed, 'dstPath'), '');
  assert.equal(setting(embed, 'dstSubfolderSpec'), '13');
  const builds = list(embed, 'files').map(id => objects.get(id));
  assert.equal(builds.length, 1);
  assert.equal(ref(builds[0], 'fileRef'), productId);
  assert.match(builds[0], /ATTRIBUTES = \(RemoveHeadersOnCopy, \);/);
});

test('Dateien, Gruppen, Sources und System-Frameworks sind eingebunden', () => {
  const groupEntry = [...objects].find(([, body]) => setting(body, 'path') === '../EinsatzWidget');
  assert.ok(groupEntry, 'Widget-Gruppe fehlt');
  const [groupId, group] = groupEntry;
  assert.match(group, /isa = PBXGroup;/);
  assert.equal(setting(group, 'sourceTree'), '<group>');
  const projectBody = [...objects.values()].find(body => /isa = PBXProject;/.test(body));
  assert.ok(list(objects.get(ref(projectBody, 'mainGroup')), 'children').includes(groupId));
  const paths = list(group, 'children').map(id => setting(objects.get(id), 'path')).sort();
  assert.deepEqual(paths, ['DutyStateClient.swift', 'DutyStateModel.swift', 'EinsatzLiveActivity.swift', 'EinsatzStatusWidget.swift', 'EinsatzWidget.entitlements', 'EinsatzWidgetBundle.swift', 'Info.plist', 'ShortcutWidgets.swift']);
  for (const path of paths) assert.ok(existsSync(resolve(root, 'ios/EinsatzWidget', path)), path);
  const sourceRefs = body => list(phase(body, 'PBXSourcesBuildPhase'), 'files').map(id => ref(objects.get(id), 'fileRef'));
  const sharedRefs = [...objects].filter(([, body]) => /isa = PBXFileReference;/.test(body) && setting(body, 'path') === '../Shared/SharedKeys.swift');
  assert.equal(sharedRefs.length, 1, 'SharedKeys muss dieselbe Dateireferenz verwenden');
  const sharedId = sharedRefs[0][0];
  assert.ok(sourceRefs(app).includes(sharedId));
  assert.ok(sourceRefs(widget).includes(sharedId));
  const sharedBuilds = [...objects.values()].filter(body => /isa = PBXBuildFile;/.test(body) && ref(body, 'fileRef') === sharedId);
  assert.equal(sharedBuilds.length, 2);
  assert.deepEqual(sourceRefs(widget).map(id => setting(objects.get(id), 'path')).sort(), ['../Shared/EinsatzActivityAttributes.swift', '../Shared/SharedKeys.swift', 'DutyStateClient.swift', 'DutyStateModel.swift', 'EinsatzLiveActivity.swift', 'EinsatzStatusWidget.swift', 'EinsatzWidgetBundle.swift', 'ShortcutWidgets.swift']);
  assert.equal(list(phase(widget, 'PBXResourcesBuildPhase'), 'files').length, 0);
  const frameworks = list(phase(widget, 'PBXFrameworksBuildPhase'), 'files').map(id => objects.get(ref(objects.get(id), 'fileRef')));
  assert.equal(frameworks.length, 2);
  for (const name of ['WidgetKit.framework', 'SwiftUI.framework']) {
    const framework = frameworks.find(body => setting(body, 'name') === name);
    assert.ok(framework, name);
    assert.equal(setting(framework, 'lastKnownFileType'), 'wrapper.framework');
    assert.equal(setting(framework, 'path'), `System/Library/Frameworks/${name}`);
    assert.equal(setting(framework, 'sourceTree'), 'SDKROOT');
  }
});

test('Debug und Release haben passende Bundle-, Versions- und Deployment-Einstellungen', () => {
  const appConfigs = configurations(app);
  const widgetConfigs = configurations(widget);
  assert.deepEqual(widgetConfigs.map(body => setting(body, 'name')).sort(), ['Debug', 'Release']);
  for (const config of widgetConfigs) {
    const appConfig = appConfigs.find(body => setting(body, 'name') === setting(config, 'name'));
    assert.ok(setting(config, 'PRODUCT_BUNDLE_IDENTIFIER').startsWith(`${setting(appConfig, 'PRODUCT_BUNDLE_IDENTIFIER')}.widget`));
    assert.equal(setting(config, 'PRODUCT_BUNDLE_IDENTIFIER'), 'cloud.einsatzleiter.app.widget');
    assert.ok(Number(setting(config, 'IPHONEOS_DEPLOYMENT_TARGET')) >= 16.2);
    assert.equal(setting(appConfig, 'IPHONEOS_DEPLOYMENT_TARGET'), '15.5');
    for (const key of ['MARKETING_VERSION', 'CURRENT_PROJECT_VERSION']) assert.equal(setting(config, key), setting(appConfig, key));
    for (const [key, value] of Object.entries({
      PRODUCT_NAME: '$(TARGET_NAME)', INFOPLIST_FILE: '../EinsatzWidget/Info.plist',
      CODE_SIGN_ENTITLEMENTS: '../EinsatzWidget/EinsatzWidget.entitlements', CODE_SIGN_STYLE: 'Automatic',
      GENERATE_INFOPLIST_FILE: 'NO', SWIFT_VERSION: '5.0', TARGETED_DEVICE_FAMILY: '1,2', SKIP_INSTALL: 'YES',
    })) assert.equal(setting(config, key), value, key);
    assert.match(config, /LD_RUNPATH_SEARCH_PATHS = \(\s*"\$\(inherited\)",\s*"@executable_path\/Frameworks",\s*"@executable_path\/\.\.\/\.\.\/Frameworks",\s*\);/);
    assert.ok(!config.includes('ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME'));
    for (const key of ['SDKROOT', 'ENABLE_USER_SCRIPT_SANDBOXING']) {
      if (setting(appConfig, key) === undefined) assert.equal(setting(config, key), undefined, `${key} erben`);
    }
  }
});

test('Plists sind mit plistlib lesbar und enthalten Extension-Metadaten und App Group', () => {
  const paths = ['ios/App/App/Info.plist', 'ios/EinsatzWidget/Info.plist', 'ios/App/App/App.entitlements', 'ios/EinsatzWidget/EinsatzWidget.entitlements'];
  const parsed = JSON.parse(execFileSync('python3', ['-c',
    'import json, plistlib, sys; print(json.dumps([plistlib.load(open(p, "rb")) for p in sys.argv[1:]]))',
    ...paths.map(path => resolve(root, path))], { encoding: 'utf8' }));
  const [appInfo, widgetInfo, appEntitlements, widgetEntitlements] = parsed;
  assert.equal(widgetInfo.NSExtension.NSExtensionPointIdentifier, 'com.apple.widgetkit-extension');
  assert.equal(widgetInfo.CFBundleDisplayName, 'Einsatzstatus');
  assert.equal(widgetInfo.CFBundlePackageType, 'XPC!');
  assert.equal(widgetInfo.CFBundleExecutable, '$(EXECUTABLE_NAME)');
  assert.equal(widgetInfo.CFBundleName, '$(PRODUCT_NAME)');
  assert.equal(widgetInfo.CFBundleIdentifier, '$(PRODUCT_BUNDLE_IDENTIFIER)');
  assert.equal(widgetInfo.CFBundleInfoDictionaryVersion, '6.0');
  assert.ok(['$(DEVELOPMENT_LANGUAGE)', 'de'].includes(widgetInfo.CFBundleDevelopmentRegion));
  for (const key of ['CFBundleShortVersionString', 'CFBundleVersion']) assert.equal(widgetInfo[key], appInfo[key]);
  assert.deepEqual(widgetEntitlements['com.apple.security.application-groups'], ['group.cloud.einsatzleiter.app']);
  assert.ok(appEntitlements['com.apple.security.application-groups'].includes('group.cloud.einsatzleiter.app'));
});

test('Einsatzstatus schützt den iOS-17-Hintergrund und unterstützt Sperrbildschirm', () => {
  const swift = read('ios/EinsatzWidget/EinsatzStatusWidget.swift');
  assert.match(read('ios/EinsatzWidget/EinsatzWidgetBundle.swift'), /@main\s+struct EinsatzWidgetBundle: WidgetBundle/);
  assert.match(swift, /StaticConfiguration\(kind: "EinsatzStatusWidget"/);
  assert.match(swift, /result.state.incident != nil \? 300 : 900/);
  assert.match(swift, /if #available\(iOS 17.0, \*\) \{[\s\S]*?\.containerBackground\(for: \.widget\)[\s\S]*?\} else \{\s*content.background\(Color\(\.systemBackground\)\)/);
  assert.match(swift, /\.supportedFamilies\(\[\.systemSmall, \.systemMedium, \.accessoryRectangular, \.accessoryInline\]\)/);
  for (const label of ['Kein Einsatz', 'Anmeldung nötig', 'Dienst aktiv']) assert.ok(swift.includes(`"${label}"`));
});
