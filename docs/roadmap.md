# Roadmap iOS/iPadOS

## P1 – Kern-App im Simulator testen

Launcher, Account-Login, Geräteanmeldung über QR/PIN, Logout und Zurücksetzen prüfen. Offline-Start mit bereits gefülltem Web-Cache und ohne Cache testen. Safe Areas, Rotation, iPad Split View und Navigation zwischen lokaler Origin und PWA prüfen. CI baut unsigned x86_64-Simulator-Artefakte. Der Kamera-Scan braucht zusätzlich spätere Tests auf echter Hardware. SMS-Gateway, nativer Objekt-Offline-Sync und APK-Auto-Updates bleiben bewusst außerhalb des iOS-Umfangs.

## P2 – Push und Alarmierung

Firebase Messaging mit APNs integrieren. Firebase-iOS-App und APNs-Zugang einrichten; nur das FCM-Token an das Backend übertragen. Backend-Nachrichten um passende `APNSConfig`, Header und Payload ergänzen. Berechtigungsdialoge, Tokenwechsel und Zuordnung zu Account/Gerät implementieren und auf echten Geräten testen. Time-Sensitive-Benachrichtigungen mit passender Capability und Unterbrechungsstufe einrichten. Für Critical Alerts einen Antrag bei Apple stellen; erst nach Genehmigung Entitlement und Nutzerzustimmung integrieren. Eine Genehmigung ist nicht garantiert.

## P3 – Live Activity

ActivityKit für laufende Einsätze entwickeln, Anzeige auf Sperrbildschirm/Dynamic Island und Start-/Update-/Ende-Zustände definieren. Datenschutz, Ablaufzeiten und optional entfernte Updates via APNs berücksichtigen. Kein Android-Foreground-Service wird übertragen.

## P4 – WidgetKit

Widget-Extension, gemeinsame Daten über App Groups und geeignete Aktualisierungszyklen umsetzen. Die im Widget sichtbaren Einsatzdaten begrenzen und Zugriff nach Logout beenden. Widgets auf iPhone und iPad testen.

## P5 – Hintergrund-GPS und Universal Links

Vorhandenes Background-Geolocation-Plugin an den aktiven Einsatz anbinden. Standort nur während eines aktiven Einsatzes mit verständlicher Zustimmung übertragen; Hintergrundberechtigung, Energieverbrauch und Beenden des Trackings testen. Die vorbereiteten plist-Texte und `UIBackgroundModes: location` allein starten kein Tracking.

Associated Domains für die App einrichten und `apple-app-site-association` auf dem Server bereitstellen. Pfade und App-ID/Team-ID abstimmen, Launch-URL-Handling bei Kaltstart und laufender App testen. App-bound Domains ersetzen keine Universal-Link-Konfiguration.

## P6 – Signierung und Veröffentlichung

Apple-Developer-Account und App-Store-Connect-App einrichten, Bundle-ID `cloud.einsatzleiter.app` zuordnen, Zertifikate und Provisioning konfigurieren. Signierte Geräte-/Archiv-Builds und anschließend TestFlight in CI ergänzen. Benötigte Secrets getrennt hinterlegen. Datenschutzangaben, Standortnutzung und Drittanbieter-SDKs prüfen, Screenshots und App-Review-Unterlagen erstellen. Für App Review einen funktionierenden Demo-Zugang samt nachvollziehbarem Testszenario bereitstellen; Anmeldung und Gerätebindung dürfen die Prüfung nicht blockieren.

Die Mitgliedschaft aus P6 wird bereits für produktive Teile von P2–P5 benötigt; Phasen können deshalb organisatorisch überlappen. Der aktuelle Workflow enthält keine deaktivierten Signierungsjobs.

## Braucht Apple-Developer-Account

- APNs-Zugang, Push-Capability und produktive Firebase/APNs-Konfiguration.
- Critical-Alerts-Antrag und das genehmigte Entitlement.
- Signierte Tests auf Geräten mit den vorgesehenen Capabilities.
- Associated Domains/Universal Links mit Team-ID und Provisioning; App Groups für gemeinsame Widget-Daten.
- Verteilung über TestFlight, App Store Connect und App Review.

Reine lokale Node-Tests, Xcode-Simulator-Builds und die grundlegende Entwicklung der Live-Activity-/Widget-Oberflächen im Simulator benötigen keine bezahlte Mitgliedschaft. Produktive Push-Updates und Verteilung benötigen die passende Signierung und Account-Einrichtung.
