# Widgets

## Widget-Extension

Das Target `EinsatzWidget` enthält unter `ios/EinsatzWidget/` ein WidgetBundle und das Platzhalter-Widget `EinsatzStatusWidget` für kleine und mittlere Widgets. Die App baut die Extension über eine Target-Abhängigkeit mit und bettet `EinsatzWidget.appex` in `App.app/PlugIns` ein. Die Embed-Phase steht vor `[CP] Embed Pods Frameworks`, um einen Build-Zyklus zu vermeiden.

Die Bundle-ID lautet `cloud.einsatzleiter.app.widget`. Die Extension setzt iOS 16.2+ voraus; die App selbst läuft weiterhin ab iOS 15.5. Beide Targets verwenden dieselben Versionswerte, die CI beim Build überschreibt. Für signierte Builds müssen die App-ID `cloud.einsatzleiter.app.widget` und die App Group `group.cloud.einsatzleiter.app` später im Apple-Developer-Portal angelegt und entsprechend provisioniert werden.

Die Extension kompiliert dieselbe Datei `ios/Shared/SharedKeys.swift` wie die App. Als Verbindungstest liest der Platzhalter `baseUrl` aus dem gemeinsamen UserDefaults-Container und zeigt bei einem nicht leeren Wert „Angemeldet“, sonst „Anmeldung nötig“. Das ist vorerst nur ein Speichertest, keine Prüfung der Geräte-Token-Anmeldung. Die Timeline enthält einen Eintrag und bittet nach 15 Minuten um Aktualisierung; echte Einsatzdaten folgen später.

## Gemeinsamer Speicher

Die Widget-Extension kann die Capacitor Preferences der App nicht lesen. Die App Group `group.cloud.einsatzleiter.app` stellt dafür einen gemeinsamen UserDefaults-Container bereit. `ios/Shared/SharedKeys.swift` definiert die Schlüssel und wird von App und Extension kompiliert.

Die App synchronisiert Server-Basis-URL, Geräte-Token und den Status `ec_device_access_invalid` als Strings. `updatedAt` enthält den Unix-Zeitstempel der letzten Änderung. Fehlt der Token oder ist er leer, werden der gemeinsame Token und der Cache `widget.dutyState` gelöscht. Nur Änderungen lösen einen Widget-Timeline-Reload aus.

Der native Sync läuft beim App-Start, bei Aktivierung und beim Wechsel in den Hintergrund. JS-seitige Preferences-Änderungen lösen keinen synchronen Sync aus; bis zum nächsten Lifecycle-Sync kann das Widget noch den bisherigen Stand sehen.

Der widerrufliche Geräte-Token liegt im App-Group-Container. Das entspricht dem Android-SharedPreferences-Ansatz; Keychain-Sharing wäre eine spätere Härtung. Die Extension verwendet dasselbe App-Group-Entitlement; für signierte Builds muss die Gruppe auch im Apple-Provisioning eingerichtet sein.

Widgets unterstützen nur Geräte-Token-Anmeldungen. Konto-Logins mit reinem Session-Cookie sehen im Widget „Anmeldung nötig“.
