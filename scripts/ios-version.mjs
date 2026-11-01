import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function iosVersion(value) {
  const parts = value.replace(/^v/, '').split('.');
  if (parts.length < 3 || !parts.every(part => /^\d+$/.test(part))) {
    throw new Error('Version muss mindestens drei numerische Teile enthalten: ' + value);
  }
  return parts.slice(0, 3).map(part => BigInt(part).toString()).join('.');
}

export function versionForBuild(env, packageVersion) {
  return iosVersion(env.GITHUB_REF?.startsWith('refs/tags/v')
    ? env.GITHUB_REF.slice('refs/tags/'.length) : packageVersion);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  console.log(versionForBuild(process.env, pkg.version));
}
