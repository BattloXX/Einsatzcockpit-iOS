# Einsatzcockpit iOS-App

Native iPhone- und iPad-App für [einsatzcockpit.com](https://einsatzcockpit.com), als Capacitor-8-Hülle der bestehenden PWA. Gegenstück zur [Android-App](https://github.com/BattloXX/Einsatzcockpit-Android). Diese Phase liefert das Gerüst für Simulator-Tests; signierte Builds und TestFlight folgen später.

## Funktionsumfang

| Funktion | iOS/iPadOS in dieser Phase | Android-Referenz |
| --- | --- | --- |
| PWA in nativer WebView | Vorhanden | Vorhanden |
| Persönlicher Account | Direkter Web-Login | Web-Login, optionale native Dienste |
| Geräteanmeldung | QR-Code oder PIN, Token in Preferences | Vorhanden |
| Offline-Start | Sprung zur gecachten PWA-Startseite ohne Query | Zusätzlich native Offline-Funktionen |
| Objekt-Offline-Sync | Bewusst weggelassen | Vorhanden |
| SMS-Gateway | Bewusst weggelassen; kombinierte QR-Codes melden nur das Gerät an | Vorhanden |
| APK-Auto-Update | Entfällt auf iOS | Eigene Update-Variante |
| Push | Später: Firebase Messaging mit FCM und APNs | Vorhanden |
| Alarmierung trotz Stummmodus | Später: Critical Alerts mit Apple-Genehmigung | Alarmkanal/DND-Integration |
| Live-Einsatzstatus | Später: Live Activity | Nativer Hintergrunddienst |
| Widgets | Später: WidgetKit | Vorhanden |
| Hintergrund-GPS | Plugin und Berechtigungstexte vorbereitet; Aktivierung/Integration später | Nativer Dienst |
| Universal Links | Später; vorhandenes Launch-URL-Handling bleibt erhalten | App Links |

## Architektur

`www/index.html` ist die lokale Startseite mit Capacitor-Bridge. Sie speichert Geräte-Token über Preferences und leitet zur PWA weiter. PIN-Rückkehr und Logout werden lokal verarbeitet. Persönliche Accounts nutzen Web-Sitzungen. Die lokale Seite `www/about.html` zeigt App-Version und Build aus `App.getInfo()`, Plattform und ausschließlich den Ja/Nein-Status des Geräte-Tokens. Das Zurücksetzen entfernt die Anmeldeschlüssel und öffnet den Server-Logout.

`capacitor.config.ts` erlaubt die PWA-Navigation und setzt `limitsNavigationsToAppBoundDomains`. `Info.plist` benennt `einsatzcockpit.com` und `www.einsatzcockpit.com` als App-bound Domains. Weitere Subdomains sind dadurch nicht automatisch freigegeben. Safe-Area-Padding liegt in den lokalen Seiten, weil `contentInset: 'never'` gesetzt ist. Die Remote-PWA muss ihre Safe Areas selbst berücksichtigen.

Offline wird bei bekannter Anmeldung direkt `https://einsatzcockpit.com/` ohne Query geladen. Verfügbarkeit hängt von einem vorherigen Online-Aufruf, Cookies und dem tatsächlich vorhandenen PWA-/WebKit-Cache ab. Es gibt keinen nativen Objekt-Sync. Die lokale `offline.html` bietet einen sicheren Wiederholungslink; eine automatische native Fehlernavigation zu dieser Seite ist in diesem Gerüst nicht implementiert. Cache und WebView-Verhalten müssen im Simulator und auf Geräten geprüft werden.

Push-Registrierung liefert derzeit immer `null`. Ein APNs-Gerätetoken darf niemals als FCM-Token ans Backend gehen. Die installierten Plugins sind App, Preferences, Keep Awake, MLKit Barcode Scanning und Background Geolocation; die Installation allein aktiviert keine Hintergrunddienste.

## Voraussetzungen und lokale Entwicklung

Für die Node-Tests genügt Node.js 22, ohne zusätzliche Test-Abhängigkeiten. Native Builds benötigen macOS 26 Tahoe, Xcode 26 mit iOS-Simulator-Runtime, CocoaPods und Node.js 22. Die Build-Skripte sind für den Intel-Mac ausgelegt. MLKit enthält keine arm64-Simulator-Slices; deshalb bauen CI und lokale Skripte ausdrücklich `ARCHS=x86_64`. Das CI-Artefakt ist eine Simulator-App für Intel und keine auf einem iPhone installierbare IPA.

```bash
npm ci
for test in scripts/*.test.mjs; do node "$test"; done
bash scripts/mac-setup.sh
bash scripts/mac-run-simulator.sh
bash scripts/mac-run-simulator.sh --ipad
```

Das Setup generiert Icons/Splash, synchronisiert Capacitor, installiert Pods und baut die App. Für spätere Änderungen: `npx cap sync ios`, anschließend Xcode öffnen mit `npm run open`. Einzelheiten einschließlich Buildpfaden, SSH und Runner-Einrichtung stehen in [docs/mac-build.md](docs/mac-build.md).

## CI und Versionen

[build-ios.yml](.github/workflows/build-ios.yml) läuft bei Push auf `main`, Tags `v*` und Pull Requests gegen `main`. Ein Ubuntu-Job prüft Launcher/Offline-Seite, plist und Shellsyntax. Der Build-Job nutzt `macos-26`, das neueste installierte Xcode 26, Node 22, `npm ci`, Asset-Generierung, Capacitor Sync und CocoaPods. Die unsigned Debug-App wird aus einem expliziten DerivedData-Verzeichnis als ZIP-Artefakt `einsatzcockpit-ios-simulator` hochgeladen. [upload-artifact](https://github.com/actions/upload-artifact) verwendet die aktuelle Major-Version 7; Checkout und Node-Setup folgen der Android-Vorgabe mit Version 7.

`scripts/ios-version.mjs` verwendet bei `refs/tags/v*` den Tag, sonst die Version aus `package.json`. Für `MARKETING_VERSION` bleiben die ersten drei numerischen Teile ohne führende Nullen: `2026.11.01.2` wird `2026.11.1`. `CURRENT_PROJECT_VERSION` kommt in CI aus `github.run_number`, lokal aus `BUILD_NUMBER` (Standard: `1`). Das Xcode-Projekt wird dafür nicht umgeschrieben. `Podfile.lock` ist nicht versioniert; Pod-Auflösung benötigt Netzwerkzugriff und kann sich mit kompatiblen Versionen ändern.

Es gibt bewusst keinen Signierungs- oder TestFlight-Job. Dafür sind später Apple-Developer-Mitgliedschaft, App-Store-Connect-App, Zertifikate/Provisioning und getrennt eingerichtete CI-Secrets erforderlich. Weder Zugangsdaten noch Firebase-Konfiguration gehören in dieses Gerüst. Die weiteren Schritte stehen in [docs/roadmap.md](docs/roadmap.md).
