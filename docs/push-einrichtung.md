# Push auf iOS einrichten

P2 ist vorbereitet und wartet auf den Apple-Account. Die App verwendet Capacitor Push Notifications und Firebase Messaging. An das bestehende Backend gehen ausschließlich FCM-Token, beim Launcher mit `fcm_platform=ios`. Die Remote-PWA bleibt unverändert. Ohne `GoogleService-Info.plist` wird Firebase nicht gestartet; die App bleibt nutzbar, Push ist deaktiviert. Die Infoseite zeigt Plugin und iOS-Berechtigung, bestätigt aber keine erfolgreiche Firebase-/APNs-Verbindung.

## Nach Erhalt des Apple-Accounts

1. In Apple Developer unter Certificates, Identifiers & Profiles eine explizite App-ID mit Bundle-ID `cloud.einsatzleiter.app` anlegen bzw. prüfen. Push Notifications aktivieren. Passende Zertifikate und Provisioning-Profile für signierte Geräte-Builds erstellen bzw. erneuern.
2. Unter Keys einen APNs-Authentifizierungsschlüssel erstellen: Apple Push Notification service aktivieren, Umgebung und Geltungsbereich passend zur App konfigurieren. Die `.p8`-Datei herunterladen und sicher verwahren; Key-ID und Team-ID notieren. Der private Schlüssel darf nicht ins Repository. Siehe [Apple: privaten Schlüssel erstellen](https://developer.apple.com/help/account/keys/create-a-private-key/).
3. Im vorgesehenen Firebase-Projekt eine iOS-App mit exakt `cloud.einsatzleiter.app` registrieren. Unter Projekteinstellungen → Cloud Messaging → iOS-App-Konfiguration den APNs-Key hochladen und Key-ID/Team-ID eintragen. Schlüssel und Umgebung müssen zu Development bzw. Production passen. Siehe [Firebase: Apple-Client einrichten](https://firebase.google.com/docs/cloud-messaging/ios/get-started).
4. Die `GoogleService-Info.plist` dieser iOS-App herunterladen. Für lokale Builds installieren:

   ```bash
   node scripts/install-google-service-info.mjs /sicherer/Pfad/GoogleService-Info.plist
   ```

   Das Skript kopiert die Datei nach `ios/App/App/GoogleService-Info.plist` und ergänzt Dateireferenz, App-Gruppe und Resources-Build-Phase im Xcode-Projekt. Liegt die Datei dort bereits, genügt der Aufruf ohne Argument. Wiederholte Aufrufe verändern das Ergebnis nicht. Ohne Quelldatei tut das Skript nichts. Die Datei ist in `.gitignore` ausgeschlossen; auch die lokal erzeugten Firebase-Projektreferenzen nicht committen, da sonst Builds ohne Datei fehlschlagen.
5. Für CI die vollständige Plist als einzeiligen Base64-Wert kodieren, zum Beispiel:

   ```bash
   base64 < /sicherer/Pfad/GoogleService-Info.plist | tr -d '\n'
   ```

   Den Wert in GitHub unter Settings → Secrets and variables → Actions als Repository-Secret `GOOGLE_SERVICE_INFO_PLIST` hinterlegen. Den Wert nicht in Logs oder Issues veröffentlichen. Der Workflow dekodiert ihn vor „Simulator-App bauen“ und ruft das Installationsskript auf. Ohne Secret überspringt er diesen Schritt. Der APNs-Key gehört nach Firebase, nicht in dieses CI-Secret.
6. Lokal `npm ci` und `npx cap sync ios` ausführen, anschließend in `ios/App` die Pods mit `pod install` installieren. Das Deployment-Target bleibt 15.5. Die Integration orientiert sich an [Capacitor: FCM auf iOS](https://capacitorjs.com/docs/guides/push-notifications-firebase). Firebase-Swizzling bleibt beim Standardwert aktiviert.
7. In Xcode für einen signierten Geräte-Build das Team und Provisioning prüfen. `App/App.entitlements` enthält aktuell `aps-environment = development` für Debug und Release. Vor einer Distribution/TestFlight-Veröffentlichung die Release-Signierung auf `production` mit passendem Profil umstellen und die tatsächlich signierten Entitlements prüfen. Der aktuelle CI-Build bleibt unsigniert (`CODE_SIGNING_ALLOWED=NO`, x86_64-Simulator).

## Abnahme auf Hardware und in CI

- Xcode 26/Swift-5-Build ohne Firebase-Plist: App startet, Push-Fehler verhindert den Login nicht; kein APNs-Rohtoken erreicht das Backend.
- Mit gültiger Konfiguration und Signierung: Berechtigung erteilen/verweigern/offen lassen, Account-, QR- und PIN-Anmeldung testen. Die Push-Vorbereitung wartet insgesamt höchstens vier Sekunden, auch bei offenem Dialog oder fehlendem Registrierungsereignis.
- Backend-Zuordnung des FCM-Tokens mit Plattform `ios`, Tokenwechsel sowie erneute Anmeldung prüfen. Der MessagingDelegate meldet neue FCM-Token über das bestehende Capacitor-Registrierungsereignis.
- Zustellung im Vordergrund (Badge/Ton/Hinweis), Hintergrund und nach Beenden sowie Tippen auf eine Nachricht über die bestehende PWA-Bridge testen. Backend-APNs-Header/Payload und Development-/Production-Umgebung prüfen.
- Normale Push-Mitteilungen garantieren keine hörbare Alarmierung bei Stumm/Nicht stören. Time Sensitive und Critical Alerts sind weitere Arbeit; der [Critical-Alerts-Antrag](critical-alerts-antrag.md) ist nur vorbereitet. Es ist noch kein Critical-Alerts-Entitlement eingebaut.

Linux prüft Launcher, Installationsskript und Dateisyntax. CocoaPods-Auflösung, Xcode-Kompilierung und App-Start ohne Plist müssen auf macOS geprüft werden; echte Zustellung benötigt zusätzlich Account, Konfiguration und signierte Hardwaretests.
