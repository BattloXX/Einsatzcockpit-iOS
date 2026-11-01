# Widgets

## Gemeinsamer Speicher

Die Widget-Extension kann die Capacitor Preferences der App nicht lesen. Die App Group `group.cloud.einsatzleiter.app` stellt dafür einen gemeinsamen UserDefaults-Container bereit. `ios/Shared/SharedKeys.swift` definiert die Schlüssel und soll später auch von der Extension kompiliert werden.

Die App synchronisiert Server-Basis-URL, Geräte-Token und den Status `ec_device_access_invalid` als Strings. `updatedAt` enthält den Unix-Zeitstempel der letzten Änderung. Fehlt der Token oder ist er leer, werden der gemeinsame Token und der Cache `widget.dutyState` gelöscht. Nur Änderungen lösen einen Widget-Timeline-Reload aus.

Der native Sync läuft beim App-Start, bei Aktivierung und beim Wechsel in den Hintergrund. JS-seitige Preferences-Änderungen lösen keinen synchronen Sync aus; bis zum nächsten Lifecycle-Sync kann das Widget noch den bisherigen Stand sehen.

Der widerrufliche Geräte-Token liegt im App-Group-Container. Das entspricht dem Android-SharedPreferences-Ansatz; Keychain-Sharing wäre eine spätere Härtung. Die spätere Extension benötigt dasselbe App-Group-Entitlement; für signierte Builds muss die Gruppe auch im Apple-Provisioning eingerichtet sein.

Widgets unterstützen nur Geräte-Token-Anmeldungen. Konto-Logins mit reinem Session-Cookie sehen im Widget „Anmeldung nötig“.
