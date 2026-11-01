import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = path => readFileSync(resolve(root, path), 'utf8');
const model = read('ios/EinsatzWidget/DutyStateModel.swift');
const client = read('ios/EinsatzWidget/DutyStateClient.swift');
const fixtures = Object.fromEntries(readdirSync(resolve(root, 'scripts/fixtures'))
  .filter(name => /^duty-state-.*\.json$/.test(name))
  .map(name => [name, JSON.parse(read(`scripts/fixtures/${name}`))]));
const blocks = [...model.matchAll(/struct (\w+): Codable \{([\s\S]*?)(?=\nstruct |$)/g)];
const keys = Object.fromEntries(blocks.map(([, name, body]) => [name,
  [...body.matchAll(/case (\w+) = "([a-z_]+)"/g)].map(([, property, wire]) => ({ property, wire }))]));
const samples = {
  DutyState: Object.values(fixtures),
  DutyIncident: [fixtures['duty-state-incident.json'].incident],
  DutyObject: [fixtures['duty-state-incident.json'].incident.objekt],
  DutyQueue: [fixtures['duty-state-queue.json'].my_lage_queue],
  DutyAssignment: [fixtures['duty-state-queue.json'].my_lage_queue.current],
  DutyLage: [fixtures['duty-state-lage.json'].lage],
};

test('Alle Swift-Felder werden explizit optional dekodiert und in passenden Fixtures abgedeckt', () => {
  assert.equal(blocks.length, 6);
  for (const [name, body] of blocks.map(([, name, body]) => [name, body])) {
    assert.ok(keys[name].length > 0, name);
    const decoded = [...body.matchAll(/try\? values\.decodeIfPresent\([^\n]*forKey: \.(\w+)\)/g)].map(match => match[1]);
    assert.deepEqual(decoded.sort(), keys[name].map(key => key.property).sort(), name);
    for (const { wire } of keys[name]) {
      assert.ok(samples[name].some(sample => Object.hasOwn(sample, wire)), `${name}.${wire} fehlt in Fixtures`);
    }
  }
  assert.equal(fixtures['duty-state-none.json'].incident, null);
  assert.equal(fixtures['duty-state-missing.json'].incident.started_at, undefined);
  assert.equal(typeof fixtures['duty-state-malformed.json'].incident, 'string');
  assert.ok(fixtures['duty-state-malformed.json'].my_lage_queue.current);
  assert.ok(Array.isArray(fixtures['duty-state-malformed-queue.json'].my_lage_queue));
  assert.equal(fixtures['duty-state-incident.json'].incident.phase_index, 1);
  assert.equal(fixtures['duty-state-incident.json'].incident.phase_count, 4);
});

test('Neue Dateien sind über Gruppe, BuildFile und EinsatzWidget-Sources verbunden', () => {
  const project = read('ios/App/App.xcodeproj/project.pbxproj');
  const definitions = [...project.matchAll(/^\t\t([A-F0-9]{24})(?: \/\*[^\n]*?\*\/)? = (\{[^\n]*\};|\{\n[\s\S]*?^\t\t\};)/gm)];
  const objects = new Map(definitions.map(([, id, body]) => [id, body]));
  const group = [...objects.values()].find(body => /path = "?\.\.\/EinsatzWidget"?;/.test(body));
  const target = [...objects.values()].find(body => /isa = PBXNativeTarget;/.test(body) && /name = EinsatzWidget;/.test(body));
  const phases = target.match(/buildPhases = \(([\s\S]*?)\);/)[1].match(/[A-F0-9]{24}/g).map(id => objects.get(id));
  const sources = phases.find(body => /isa = PBXSourcesBuildPhase;/.test(body));
  for (const name of ['DutyStateModel.swift', 'DutyStateClient.swift']) {
    const [refId] = [...objects].find(([, body]) => /isa = PBXFileReference;/.test(body) && body.includes(`path = ${name};`));
    const [buildId] = [...objects].find(([, body]) => /isa = PBXBuildFile;/.test(body) && body.includes(`fileRef = ${refId}`));
    assert.match(refId, /^EC00000000000000000002[0-9A-F]{2}$/);
    assert.match(buildId, /^EC00000000000000000002[0-9A-F]{2}$/);
    assert.ok(group.includes(refId), name);
    assert.ok(sources.includes(buildId), name);
  }
});

test('Client enthält keine Versionsmeldung oder Klartext-HTTP und nutzt ephemere Requests', () => {
  assert.doesNotMatch(client, /app_version|http:\/\//i);
  assert.match(client, /URLSessionConfiguration\.ephemeral/);
  assert.match(client, /session\.data\(for: request\)/);
  assert.match(client, /timeoutIntervalForResource = 15/);
  for (const header of ['Authorization', 'X-Requested-With', 'X-ECP-Platform', 'Accept', 'X-ECP-Auth-Error']) {
    assert.ok(client.includes(`"${header}"`), header);
  }
  assert.match(client, /parts\.scheme\?\.lowercased\(\) == "https"/);
  assert.match(client, /host == "einsatzcockpit.com" \|\| host.hasSuffix\("\.einsatzcockpit.com"\)/);
  assert.match(client, /completionHandler\(nil\)/);
  assert.match(model, /formatter.formatOptions = \[\.withInternetDateTime\]/);
  assert.match(client, /DutyState.parse\(cache.json, now: cache.fetchedAt\)/);
});

const backendRoot = '/home/johannes/projects/einsatzcockpit';
test('Fixture-Feldnamen stimmen mit den echten Python-Backend-Payloads überein', {
  skip: !existsSync(resolve(backendRoot, 'app/routers/device_api.py')) && 'Backend-Referenz ist auf diesem Rechner nicht vorhanden',
}, () => {
  // Read only: extract dictionary keys from the actual return payloads via Python AST.
  const payloads = JSON.parse(execFileSync('python3', ['-c', `
import ast, json, pathlib, sys
root = pathlib.Path(sys.argv[1])
result = {}
for path in ['app/routers/device_api.py', 'app/services/einsatz_live_service.py', 'app/services/gsl_live_service.py']:
    tree = ast.parse((root / path).read_text())
    for fn in ast.walk(tree):
        if isinstance(fn, (ast.FunctionDef, ast.AsyncFunctionDef)):
            result[fn.name] = sorted({key.value for node in ast.walk(fn) if isinstance(node, ast.Dict) for key in node.keys if isinstance(key, ast.Constant) and isinstance(key.value, str)})
print(json.dumps(result))
`, backendRoot], { encoding: 'utf8' }));
  const sourceFunctions = {
    DutyState: 'get_duty_state', DutyIncident: 'build_incident_live_payload',
    DutyObject: '_linked_objekt_summary', DutyQueue: 'build_my_lage_queue',
    DutyAssignment: '_einheit_site_payload', DutyLage: 'build_gsl_live_payload',
  };
  for (const [name, fn] of Object.entries(sourceFunctions)) {
    assert.ok(payloads[fn]?.length, fn);
    for (const { wire } of keys[name]) assert.ok(payloads[fn].includes(wire), `${name}.${wire} fehlt im Backend ${fn}`);
    for (const sample of samples[name]) {
      if (!sample || typeof sample !== 'object' || name === 'DutyState') continue;
      for (const wire of Object.keys(sample)) assert.ok(payloads[fn].includes(wire), `Fixture ${name}.${wire} weicht vom Backend ab`);
    }
  }
  for (const wire of keys.DutyAssignment.map(key => key.wire).filter(key => !['auftrag', 'einheit_status', 'einheit_url'].includes(key))) {
    assert.ok(payloads._site_payload.includes(wire), `Fahrzeugprofil: ${wire}`);
  }
});
