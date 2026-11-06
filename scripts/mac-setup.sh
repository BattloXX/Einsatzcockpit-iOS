#!/usr/bin/env bash
set -euo pipefail

REPO_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$REPO_DIR"
if [[ $(uname -s) != Darwin ]]; then
  echo 'Dieses Skript benötigt einen Intel-Mac mit macOS 15 oder neuer.' >&2
  exit 1
fi
# Xcode 26 läuft ab macOS 15 Sequoia; Tahoe ist nicht auf allen Intel-Macs verfügbar.
if (( $(sw_vers -productVersion | cut -d. -f1) < 15 )) || [[ $(uname -m) != x86_64 ]]; then
  echo 'Benötigt: Intel-Mac (x86_64), macOS 15 oder neuer und Xcode 26.' >&2
  exit 1
fi
# shellcheck source=scripts/mac-env.sh
source "$REPO_DIR/scripts/mac-env.sh"
if [[ ! -d /Applications/Xcode.app ]] && ! compgen -G '/Applications/Xcode_26*.app' >/dev/null; then
  echo 'Xcode fehlt. Bitte Xcode 26 aus dem App Store installieren und einmal öffnen.' >&2
  exit 1
fi
XCODE_APP=$(python3 - <<'PY'
import glob, re
paths = glob.glob('/Applications/Xcode_26*.app')
if '/Applications/Xcode.app' not in paths:
    paths += glob.glob('/Applications/Xcode.app')
if not paths:
    raise SystemExit('Xcode fehlt. Bitte Xcode 26 aus dem App Store installieren und einmal öffnen.')
print(max(paths, key=lambda p: tuple(map(int, re.findall(r'\d+', p))) or (0,)))
PY
)
if [[ $(xcode-select -p 2>/dev/null || true) != "$XCODE_APP/Contents/Developer" ]]; then
  sudo xcode-select -s "$XCODE_APP/Contents/Developer"
fi
if [[ $(xcodebuild -version | head -1) != 'Xcode 26'* ]]; then
  echo 'Bitte Xcode 26 aus dem App Store installieren.' >&2
  exit 1
fi
# Die Lizenz wird interaktiv angezeigt, wenn sie noch nicht akzeptiert wurde.
if ! xcodebuild -license check >/dev/null 2>&1; then
  sudo xcodebuild -license
fi
if ! xcodebuild -checkFirstLaunchStatus >/dev/null 2>&1; then
  sudo xcodebuild -runFirstLaunch
fi
xcodebuild -version
ensure_node
ensure_cocoapods
node --version
pod --version
# CocoaPods bricht ohne UTF-8-Locale ab.
export LANG=${LANG:-en_US.UTF-8}
npm ci
if [[ ! -f assets/icon.png ]]; then cp assets/Logo-rot.png assets/icon.png; fi
npx capacitor-assets generate --ios
npx cap sync ios
(cd ios/App && pod install)
VERSION=$(node scripts/ios-version.mjs)
BUILD_NUMBER=${BUILD_NUMBER:-1}
DERIVED_DATA=${DERIVED_DATA:-/tmp/einsatzcockpit-ios-derived}
xcodebuild -workspace ios/App/App.xcworkspace -scheme App \
  -configuration Debug -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' -derivedDataPath "$DERIVED_DATA" \
  ARCHS=x86_64 ONLY_ACTIVE_ARCH=NO CODE_SIGNING_ALLOWED=NO \
  MARKETING_VERSION="$VERSION" CURRENT_PROJECT_VERSION="$BUILD_NUMBER" build
echo "Simulator-App: $DERIVED_DATA/Build/Products/Debug-iphonesimulator/App.app"
