# Deep Links für iOS

## Universal Links

Die App ist für HTTPS-Links auf `einsatzcockpit.com` und `www.einsatzcockpit.com` vorbereitet. Die Associated Domains enthalten `applinks:einsatzcockpit.com`, `applinks:www.einsatzcockpit.com` und `webcredentials:einsatzcockpit.com`.

Das Backend muss die AASA-Datei unter `/.well-known/apple-app-site-association` für beide Hosts bereitstellen. Dafür benötigt die Backend-Konfiguration `APPLE_TEAM_ID`. Die Team-ID steht im Apple Developer Portal unter **Membership**. Die AASA-Datei muss die Team-ID mit der Bundle-ID `cloud.einsatzleiter.app` verbinden und die vorgesehenen Pfade freigeben.

Universal Links funktionieren erst mit einem signierten Build, passendem Provisioning und eingetragener Team-ID. Der Associated-Domains-Eintrag benötigt eine bezahlte Apple-Developer-Mitgliedschaft. Der unsignierte Simulator-CI-Build mit `CODE_SIGNING_ALLOWED=NO` kann weiterhin gebaut werden; er bestätigt keine funktionierende Universal-Link-Zuordnung.

## URL-Schema für Widgets und Live Activities

Widgets und Live Activities können `einsatzcockpit://open?path=/…` als Ziel verwenden. Beispielsweise öffnet `einsatzcockpit://open?path=/kontakte` die Adresse `https://einsatzcockpit.com/kontakte`.

Der Pfad muss mit genau einem `/` beginnen und darf weder Backslashes noch Steuerzeichen enthalten. Für Pfade mit Query oder Fragment den gesamten `path`-Wert URL-kodieren, beispielsweise `einsatzcockpit://open?path=%2Fkontakte%3Fgruppe%3D1%26aktiv%3D1`. Fremde Hosts und andere URL-Schemata werden vom Launcher ignoriert. `el_base_url` bleibt `https://einsatzcockpit.com`.

AppDelegate und SceneDelegate leiten URL-Aufrufe und Universal-Link-Aktivitäten bereits an Capacitor weiter. Der SceneDelegateProxy verarbeitet auch die Verbindungsoptionen beim Kaltstart; der Launcher wertet die URL über `App.getLaunchUrl()` aus.

## Test im Simulator

Die App im gestarteten Simulator installieren und anschließend ausführen:

```sh
xcrun simctl openurl booted "einsatzcockpit://open?path=/kontakte"
```

Den Aufruf mit beendeter und bereits laufender App prüfen. Nach Einrichtung von Apple-Account, Team-ID, AASA und Signierung zusätzlich Universal Links für beide Hosts bei Kaltstart und laufender App testen. Swift-Kompilierung und Simulator-Verhalten müssen unter macOS mit Xcode 26 geprüft werden.
