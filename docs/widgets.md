# Widgets

## Widget-Extension

Das Target `EinsatzWidget` enthält unter `ios/EinsatzWidget/` ein WidgetBundle und das Widget `EinsatzStatusWidget` für kleine und mittlere Widgets sowie rechteckige und einzeilige Sperrbildschirm-Widgets. Die App baut die Extension über eine Target-Abhängigkeit mit und bettet `EinsatzWidget.appex` in `App.app/PlugIns` ein. Die Embed-Phase steht vor `[CP] Embed Pods Frameworks`, um einen Build-Zyklus zu vermeiden.

Die Bundle-ID lautet `cloud.einsatzleiter.app.widget`. Die Extension setzt iOS 16.2+ voraus; die App selbst läuft weiterhin ab iOS 15.5. Beide Targets verwenden dieselben Versionswerte, die CI beim Build überschreibt. Für signierte Builds müssen die App-ID `cloud.einsatzleiter.app.widget` und die App Group `group.cloud.einsatzleiter.app` später im Apple-Developer-Portal angelegt und entsprechend provisioniert werden.

## Einsatzstatus-Widget

Die Extension kompiliert dieselbe Datei `ios/Shared/SharedKeys.swift` wie die App. Sie ruft `GET {baseUrl}/api/v1/device/duty-state` mit dem Geräte-Token als Bearer und den Headern `X-Requested-With: XMLHttpRequest`, `X-ECP-Platform: ios` und `Accept: application/json` ab. Die Basis-URL muss HTTPS und den Host `einsatzcockpit.com` oder eine Subdomain verwenden. Der Abruf nutzt eine ephemere URLSession mit 15 Sekunden Timeout, ohne Versionsparameter und ohne Weiterleitungen.

Vorrang hat ein aktiver Einsatz mit Alarmcode, Adresse, Übungskennzeichnung, Phase und lokal laufendem Zeitzähler. Das mittlere Widget zeigt zusätzlich Meldung und Objektname. Danach folgt die persönliche Lagewarteschlange mit aktuellem Auftrag und Anzahl weiterer Aufträge. Ohne beides wird eine aktive Großschadenslage mit ihrem Namen angezeigt, sonst „Kein Einsatz“ und gegebenenfalls „Dienst aktiv“. Antippen öffnet die zugehörige App-Seite über einen geprüften, prozentkodierten internen Pfad.

Fehlende Geräte-Anmeldung, ungültiger Zugang und HTTP 401/403 zeigen „Anmeldung nötig – App öffnen“ und löschen den Cache. Bei einem zusätzlichen `X-ECP-Auth-Error` speichert die Extension dessen Wert unter `widget.authFailed`. Erfolgreiche Antworten werden als Codable-Wrapper mit Abrufzeitpunkt und JSON-Daten in `widget.dutyState` gespeichert. Bei Verbindungsfehlern bleibt dieser Stand sichtbar; nach 15 Minuten erscheint „Stand HH:mm – keine Verbindung“. Ohne Cache erscheint der Hinweis sofort. Teilweise fehlerhafte Antworten werden feldweise dekodiert; ein defekter Teilbaum verwirft keine gültigen Geschwister.

Die Timeline enthält einen Eintrag und bittet bei aktivem Einsatz nach fünf Minuten, sonst nach 15 Minuten um Aktualisierung. Das WidgetKit-Budget bestimmt den tatsächlichen Abrufzeitpunkt: Aktualisierungen sind nicht sekundengenau. Der Zeitzähler läuft lokal; seine Startzeit wird beim Abruf aus der Differenz von `server_time` und `started_at` relativ zur Geräteuhr berechnet und beim Lesen des Caches am gespeicherten Abrufzeitpunkt verankert.

Unterstützt werden nur Geräte-Token-Anmeldungen; ein reines Session-Cookie genügt nicht. Push-Aktualisierung und Live Activity sind spätere Erweiterungen.

## Verknüpfungs-Widgets

Die drei Verknüpfungen zeigen Symbol und Titel und öffnen die jeweilige App-Seite:

| Widget | Pfad | SF Symbol |
| --- | --- | --- |
| Kontakte | `/kontakte` | `person.2.fill` |
| Objekte | `/objekte/` | `building.2.fill` |
| Fahrt erfassen | `/fahrtenbuch/neu` | `car.fill` |

Alle drei unterstützen kleine Home-Bildschirm-Widgets sowie kreisförmige und rechteckige Sperrbildschirm-Widgets (ab iOS 16.0; die Extension setzt iOS 16.2 voraus). Sie verwenden statische Timelines ohne geplante Aktualisierung und öffnen die Pfade über `einsatzcockpit://open?path=…`. Eine fehlende Anmeldung wird beim Öffnen von der App behandelt.

Im Gegensatz zu Android gibt es bei „Fahrt erfassen“ keine Fahrzeugauswahl pro Widget. Dafür wären iOS-Konfigurationsintents nötig. Die Fahrzeug-Vorauswahl erfolgt serverseitig über das Gerät.

## Gemeinsamer Speicher

Die Widget-Extension kann die Capacitor Preferences der App nicht lesen. Die App Group `group.cloud.einsatzleiter.app` stellt dafür einen gemeinsamen UserDefaults-Container bereit. `ios/Shared/SharedKeys.swift` definiert die Schlüssel und wird von App und Extension kompiliert.

Die App synchronisiert Server-Basis-URL, Geräte-Token und den Status `ec_device_access_invalid` als Strings. `updatedAt` enthält den Unix-Zeitstempel der letzten Änderung. Fehlt der Token oder ist er leer, werden der gemeinsame Token und der Cache `widget.dutyState` gelöscht. Nur Änderungen lösen einen Widget-Timeline-Reload aus.

Der native Sync läuft beim App-Start, bei Aktivierung und beim Wechsel in den Hintergrund. JS-seitige Preferences-Änderungen lösen keinen synchronen Sync aus; bis zum nächsten Lifecycle-Sync kann das Widget noch den bisherigen Stand sehen.

Der widerrufliche Geräte-Token liegt im App-Group-Container. Das entspricht dem Android-SharedPreferences-Ansatz; Keychain-Sharing wäre eine spätere Härtung. Die Extension verwendet dasselbe App-Group-Entitlement; für signierte Builds muss die Gruppe auch im Apple-Provisioning eingerichtet sein.

Widgets unterstützen nur Geräte-Token-Anmeldungen. Konto-Logins mit reinem Session-Cookie sehen im Widget „Anmeldung nötig“.
