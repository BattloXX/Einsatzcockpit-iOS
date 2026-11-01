# Live Activity „Laufender Einsatz“

Vorbereitet für iPhone ab iOS 16.2: Sperrbildschirm und Dynamic Island zeigen Alarmcode, Übungskennzeichnung (Sperrbildschirm), Adresse, Phase und laufende Alarmzeit. `ended: true` ersetzt den Timer durch „Einsatz beendet“. Antippen öffnet den Einsatz über den bestehenden Deep Link.

`ios/Shared/EinsatzActivityAttributes.swift` gehört zu App und Widget-Extension. Die Extension rendert die Anzeige; `LiveActivityManager` verwaltet in der App Activities und Token. Der eigene `LiveDutyState` liest nur die benötigten Duty-State-Daten. Beim Start und Aktivwerden lädt die App `/api/v1/device/duty-state`: Einsatz starten/aktualisieren, anderen Einsatz ersetzen oder ohne Einsatz sofort beenden. Die Startzeit korrigiert die Differenz zwischen `server_time` und `incident.started_at` auf die lokale Uhr. Logout beendet alle Activities. Netzwerkfehler lassen bestehende Activities unverändert.

## Backend-Vertrag

APNs `attributes-type`: exakt `EinsatzActivityAttributes`. Statische Attribute: `incident_id` (Int), `url` (String, beispielsweise `/einsatz/12`). `content-state`: `alarm_code`, `address`, `phase_index`, `phase_count`, `phase_label`, `started_at` (Double, Unix-Sekunden UTC), `unit_count`, `is_exercise`, `ended`. Der Swift-Decoder verwendet für fehlende oder falsch typisierte Felder Defaults; insbesondere 0 Einheiten, false für Übung/Ende und leere Adresse. Phasen sind nullbasiert; die Anzeige begrenzt ungültige Werte. Keine Swift-Date-JSON-Kodierung verwenden.

Token werden als Hex ohne Trennzeichen an `POST /api/v1/device/live-activity-token` gemeldet: `{"kind":"start","token":"<hex>","incident_id":null}` oder `{"kind":"activity","token":"<hex>","incident_id":12}`. Entfernen: `DELETE` desselben Pfads mit `{"token":"<hex>"}`. Authentifizierung: `Authorization: Bearer <Geräte-Token>`, dazu `Content-Type: application/json`, `X-Requested-With: XMLHttpRequest`, `X-ECP-Platform: ios`. Nur HTTPS auf einsatzcockpit.com und dessen Subdomains, keine Redirects, Timeout 15 Sekunden. Bei Meldefehlern eine Wiederholung nach 5 Sekunden; bekannte Token werden beim Aktivwerden erneut gemeldet. Nach Logout fehlt die Authentifizierung für DELETE; das Backend muss Token beim Geräte-Logout ebenfalls entkoppeln und APNs-Ungültigkeitsantworten verarbeiten.

## Lokaler Start und Push

Lokaler Start erfolgt beim Öffnen/Aktivwerden der App. Ab iOS 17.2 meldet die App zusätzlich den Push-to-Start-Token; damit kann das Backend über APNs eine Activity ohne geöffnetes App-Fenster starten. `activityUpdates` erkennt auch solche Activities und meldet deren Update-Token. Updates und Ende kommen anschließend über APNs. Ohne APNs-Schlüssel im Backend bleibt nur der lokale Start und Sync beim Öffnen der App.

Anders als die Android-Dauerbenachrichtigung ist dies kein Foreground-Service und hält keine Hintergrundarbeit am Leben. iOS begrenzt laufende Live Activities auf 8 Stunden; eine beendete Anzeige kann systemseitig noch bis zu 4 Stunden auf dem Sperrbildschirm bleiben. Benutzer können Live Activities in den Einstellungen abschalten. Die App prüft die Freigabe vor lokalem Start.

## Test und Apple-Account

Linux prüft Projektstruktur, JSON-Schlüssel und Plist mit `scripts/live-activity.test.mjs`; kein Swift-Build. Die macOS-CI kompiliert mit Xcode 26 für den unsignierten x86_64-Simulator. Dort lokalen Start, Einsatzwechsel, Ende, Logout, Deep Link und fehlerhafte/fehlende Felder prüfen. „Debug → Simulate Live Activity“ ist nur über Xcode möglich; Verfügbarkeit und Menüposition hängen von der Xcode-Version ab. Keine Simulation allein durch die Node-Tests.

Push-to-Start und APNs-Updates auf echten Geräten testen: Apple-Developer-Account, APNs-Schlüssel, Push-Capability und korrekt signierte App sind erforderlich. Start/Update/Ende-Payloads und Tokenrotation mit dem parallel entwickelten Backend prüfen. Simulator-Oberflächentests ersetzen diesen Gerätetest nicht.
