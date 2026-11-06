# Intel-Mac als Build-Rechner

Vorgesehen ist ein Intel-Mac mit macOS 15 Sequoia oder neuer und Xcode 26. Xcode 26 läuft bereits unter Sequoia; macOS 26 Tahoe ist nicht nötig und steht auch nicht für alle Intel-Macs zur Verfügung, etwa nicht für das MacBook Pro 13" (2020) mit zwei Thunderbolt-Ports. Die [Kompatibilitätsliste für Tahoe](https://support.apple.com/en-euro/122867) nennt die unterstützten Modelle. Tahoe ist die letzte macOS-Hauptversion für Intel-Macs; für spätere SDK-/Xcode-Generationen muss ein Wechsel auf Apple Silicon eingeplant werden. Apple erläutert die Übergangsplanung in [Platforms State of the Union 2025](https://developer.apple.com/videos/play/wwdc2025/102/).

## Einrichtung

1. Xcode 26 nach `/Applications/Xcode.app` installieren (App Store oder Download von developer.apple.com) und einmal öffnen. Unter Xcode → Settings → Components eine iOS-Simulator-Runtime installieren. Unter Window → Devices and Simulators einen iPhone- und bei Bedarf iPad-Simulator anlegen.
2. Repository auf dem Mac auschecken und `bash scripts/mac-setup.sh` ausführen. `sudo` kann für die Auswahl von Xcode, Lizenzbestätigung und First-Launch-Schritte erforderlich sein. Die Lizenz wird bei Bedarf interaktiv angezeigt. First Launch wird nur bei ausstehender Einrichtung ausgeführt.
3. Homebrew wird nicht benötigt, weil es Intel-Macs nicht mehr vollständig unterstützt. Fehlen Node 22 oder `pod`, installiert `scripts/mac-env.sh` sie ohne `sudo` nach `~/.local` (abweichend per `EC_TOOLS_DIR`): Node 22 als offizielles Paket von nodejs.org und CocoaPods in einem portablen Ruby 3.4 aus dem Homebrew-Portable-Ruby-Projekt. Beide Downloads werden per SHA-256 geprüft. Das System-Ruby 2.6 ist für aktuelles CocoaPods zu alt.
4. Das Skript führt anschließend `npm ci`, die Asset-Generierung, `npx cap sync ios` und `pod install` aus und baut den Simulator ohne Signierung. Wiederholte Aufrufe sind möglich.

Für ein eigenes Terminal die Werkzeuge dauerhaft in den PATH aufnehmen, etwa in `~/.zprofile`:

```bash
export PATH="$HOME/.local/node/bin:$HOME/.local/ruby/bin:$PATH"
```

Bei abweichendem Xcode-Pfad erwartet das Setup entweder `/Applications/Xcode.app` oder `/Applications/Xcode_26*.app`. Es bevorzugt die höchste nummerierte Installation und prüft anschließend Version 26. Netzwerk wird für npm, CocoaPods und Simulator-Runtimes benötigt. `Podfile.lock` wird lokal erzeugt und nicht versioniert.

```bash
bash scripts/mac-setup.sh
bash scripts/mac-run-simulator.sh
bash scripts/mac-run-simulator.sh --ipad
```

Die App liegt standardmäßig unter `/tmp/einsatzcockpit-ios-derived/Build/Products/Debug-iphonesimulator/App.app`. `DERIVED_DATA` überschreibt das Build-Verzeichnis in beiden Skripten, `APP_PATH` alternativ die zu installierende App. `BUILD_NUMBER` setzt beim Setup die lokale Buildnummer. Das Run-Skript wählt verfügbare iOS-Geräte der neuesten Runtime; `IPHONE_UDID` und `IPAD_UDID` erlauben eine gezielte Auswahl. Es wartet auf den Boot, installiert die App und startet `cloud.einsatzleiter.app`. Mit `--ipad` wird zusätzlich ein iPad gestartet.

Der Build verwendet `ARCHS=x86_64`, `ONLY_ACTIVE_ARCH=NO` und `CODE_SIGNING_ALLOWED=NO`. Hintergrund ist MLKit ohne arm64-Simulator-Slices. Das Artefakt aus CI per ZIP entpacken und mit `APP_PATH=/pfad/App.app bash scripts/mac-run-simulator.sh` auf dem Intel-Mac starten. Der unsignierte Simulator-Build eignet sich nicht für reale iPhones oder TestFlight. Kamera-Scans und Berechtigungen zusätzlich später auf echter Hardware testen.

## Entfernter Zugriff per SSH

Unter Systemeinstellungen → Allgemein → Freigaben → Entfernte Anmeldung aktivieren. Zugriff auf die vorgesehenen Benutzer begrenzen. Mit `ssh benutzer@mac-hostname` anmelden und das Repository im Benutzerverzeichnis bearbeiten. SSH-Schlüssel auf dem zugreifenden Rechner erzeugen und den öffentlichen Schlüssel beim Mac-Benutzer in `~/.ssh/authorized_keys` hinterlegen. Private Schlüssel bleiben auf dem zugreifenden Rechner.

Xcode-Ersteinrichtung, Lizenz und Simulator-Runtimes zunächst in einer interaktiven Sitzung erledigen. Für die sichtbare Simulator-Oberfläche eine angemeldete grafische Benutzersitzung verwenden; ein SSH-Aufruf allein stellt keinen sichtbaren Desktop bereit.

## Optional: Self-hosted GitHub Runner

Im Repository unter Settings → Actions → Runners → New self-hosted runner macOS/X64 wählen und die dort erzeugten Download-/Registrierungsbefehle auf dem Mac ausführen. Registrierungstoken nur dort verwenden, nicht im Repository speichern. Labels: `self-hosted`, `macOS`, `X64`. Runner-Version aktuell halten, insbesondere für Actions mit Node-24-Runtime.

Nach erfolgreichem lokalen Build kann ein eigener Workflow oder eine bewusste Umstellung des Build-Jobs `runs-on: [self-hosted, macOS, X64]` nutzen. Der mitgelieferte Workflow bleibt auf `macos-26`. Auf dem eigenen Runner Xcode/Node/PATH und Schreibrechte für Arbeitsverzeichnis, npm und CocoaPods einrichten. In der grafischen Benutzersitzung zunächst `./run.sh` testen; einen dauerhaften Dienst nach der GitHub-Runner-Anleitung einrichten.

Ungeprüfte Pull Requests sollten auf einem privaten Build-Rechner mit gespeicherten Zugangsdaten nicht ausgeführt werden. Für den Simulator sind keine Apple-Zertifikate erforderlich. Signierung und TestFlight werden erst mit eingerichtetem Apple-Developer-Account ergänzt.
