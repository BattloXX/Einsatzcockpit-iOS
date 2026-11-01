import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Optional: node scripts/install-google-service-info.mjs /Pfad/GoogleService-Info.plist
export function installGoogleServiceInfo(root, source) {
  const destination = resolve(root, 'ios/App/App/GoogleService-Info.plist');
  const input = source ? resolve(source) : destination;
  if (!existsSync(input)) return false;

  const project = resolve(root, 'ios/App/App.xcodeproj/project.pbxproj');
  let text = readFileSync(project, 'utf8');
  const fileID = 'EC0000000000000000000002';
  const buildID = 'EC0000000000000000000003';
  const insert = (marker, line) => {
    if (text.split(marker).length !== 2) throw new Error(`Projektstruktur nicht eindeutig: ${marker}`);
    text = text.replace(marker, marker + line);
  };
  if (!text.includes(`${fileID} /* GoogleService-Info.plist */ =`)) {
    if (text.includes(fileID)) throw new Error('Firebase-Datei-ID bereits belegt');
    insert('/* Begin PBXFileReference section */',
      `\n\t\t${fileID} /* GoogleService-Info.plist */ = {isa = PBXFileReference; lastKnownFileType = text.plist.xml; path = "GoogleService-Info.plist"; sourceTree = "<group>"; };`);
  }
  if (!text.includes(`${buildID} /* GoogleService-Info.plist in Resources */ =`)) {
    if (text.includes(buildID)) throw new Error('Firebase-Build-ID bereits belegt');
    insert('/* Begin PBXBuildFile section */',
      `\n\t\t${buildID} /* GoogleService-Info.plist in Resources */ = {isa = PBXBuildFile; fileRef = ${fileID} /* GoogleService-Info.plist */; };`);
  }
  const groupMarker = '504EC3061FED79650016851F /* App */ = {\n\t\t\tisa = PBXGroup;\n\t\t\tchildren = (';
  const resourceMarker = '504EC3021FED79650016851F /* Resources */ = {\n\t\t\tisa = PBXResourcesBuildPhase;\n\t\t\tbuildActionMask = 2147483647;\n\t\t\tfiles = (';
  if (!text.includes(`\t\t\t\t${fileID} /* GoogleService-Info.plist */,`)) {
    insert(groupMarker, `\n\t\t\t\t${fileID} /* GoogleService-Info.plist */,`);
  }
  if (!text.includes(`\t\t\t\t${buildID} /* GoogleService-Info.plist in Resources */,`)) {
    insert(resourceMarker, `\n\t\t\t\t${buildID} /* GoogleService-Info.plist in Resources */,`);
  }
  if (input !== destination) copyFileSync(input, destination);
  if (text !== readFileSync(project, 'utf8')) writeFileSync(project, text);
  return true;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  console.log(installGoogleServiceInfo(root, process.argv[2])
    ? 'Firebase-Plist in App-Ressourcen eingebunden.'
    : 'Keine Firebase-Plist vorhanden; Push bleibt deaktiviert.');
}
