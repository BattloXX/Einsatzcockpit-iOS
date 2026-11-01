#!/usr/bin/env bash
set -euo pipefail

if [[ $(uname -s) != Darwin || $(uname -m) != x86_64 ]]; then
  echo 'Diese x86_64-App benötigt den Simulator auf einem Intel-Mac.' >&2
  exit 1
fi
WITH_IPAD=false
case "${1:-}" in
  --ipad) WITH_IPAD=true ;;
  '') ;;
  *) echo "Aufruf: $0 [--ipad]" >&2; exit 1 ;;
esac
# node@22 ist bei Homebrew keg-only.
if command -v brew >/dev/null 2>&1; then
  export PATH="$(brew --prefix node@22)/bin:$PATH"
fi
DERIVED_DATA=${DERIVED_DATA:-/tmp/einsatzcockpit-ios-derived}
APP_PATH=${APP_PATH:-$DERIVED_DATA/Build/Products/Debug-iphonesimulator/App.app}
if [[ ! -d "$APP_PATH" ]]; then
  echo "App fehlt: $APP_PATH. Zuerst bash scripts/mac-setup.sh ausführen." >&2
  exit 1
fi
boot_and_run() {
  local family=$1
  local requested=$2
  local selected
  selected=$(xcrun simctl list devices available --json | node -e '
    let input = "";
    process.stdin.on("data", chunk => input += chunk);
    process.stdin.on("end", () => {
      const family = process.argv[1], requested = process.argv[2];
      const devices = Object.entries(JSON.parse(input).devices)
        .filter(([runtime]) => runtime.includes(".iOS-"))
        .sort(([a], [b]) => b.localeCompare(a, undefined, { numeric: true }))
        .flatMap(([, devices]) => devices)
        .filter(d => d.isAvailable && d.name.startsWith(family));
      const device = requested ? devices.find(d => d.udid === requested) : devices[0];
      if (!device) {
        console.error("Kein verfügbarer " + family + "-Simulator. In Xcode > Settings > Components eine iOS-Runtime und unter Devices and Simulators ein Gerät anlegen.");
        process.exit(1);
      }
      console.log(device.udid + " " + device.state);
    });
  ' "$family" "$requested")
  local udid=${selected%% *}
  if [[ ${selected#* } != Booted ]]; then xcrun simctl boot "$udid"; fi
  xcrun simctl bootstatus "$udid" -b
  xcrun simctl install "$udid" "$APP_PATH"
  xcrun simctl launch "$udid" cloud.einsatzleiter.app
  open -a Simulator --args -CurrentDeviceUDID "$udid"
}
boot_and_run iPhone "${IPHONE_UDID:-}"
if [[ $WITH_IPAD == true ]]; then boot_and_run iPad "${IPAD_UDID:-}"; fi
