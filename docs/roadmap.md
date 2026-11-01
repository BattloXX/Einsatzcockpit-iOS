# Roadmap iOS/iPadOS

## P1 – Kern-App im Simulator testen

Launcher, Account-Login, Geräteanmeldung über QR/PIN, Logout und Zurücksetzen prüfen. Offline-Start mit bereits gefülltem Web-Cache und ohne Cache testen. Safe Areas, Rotation, iPad Split View und Navigation zwischen lokaler Origin und PWA prüfen. CI baut unsigned x86_64-Simulator-Artefakte. Der Kamera-Scan braucht zusätzlich spätere Tests auf echter Hardware. SMS-Gateway, nativer Objekt-Offline-Sync und APK-Auto-Updates bleiben bewusst außerhalb des iOS-Umfangs.

## P2 – Push und Alarmierung

P2 ist vorbereitet und wartet auf den Apple-Account. Firebase Messaging, FCM-Token-Weitergabe, Push-Berechtigungsstatus und optionale Plist-Einbindung sind umgesetzt; ohne Plist bleibt Push deaktiviert. Einrichtung: [Push einrichten](push-einrichtung.md). Firebase-iOS-App und APNs-Zugang müssen noch eingerichtet werden. `App.entitlements` verwendet vorerst `development` für Debug und Release; spätere Release-Signierung muss mit passendem Provisioning auf `production` umgestellt werden. Backend-Nachrichten um passende `APNSConfig`, Header und Payload ergänzen. Berechtigungsdialoge, Tokenwechsel und Zuordnung zu Account/Gerät auf echten Geräten prüfen. Time-Sensitive-Benachrichtigungen mit passender Capability und Unterbrechungsstufe einrichten. Für Critical Alerts den [vorbereiteten Antrag](critical-alerts-antrag.md) bei Apple stellen; erst nach Genehmigung Entitlement und Nutzerzustimmung integrieren. Eine Genehmigung ist nicht garantiert.

## P3 – Live Activity

ActivityKit für laufende Einsätze entwickeln, Anzeige auf Sperrbildschirm/Dynamic Island und Start-/Update-/Ende-Zustände definieren. Datenschutz, Ablaufzeiten und optional entfernte Updates via APNs berücksichtigen. Kein Android-Foreground-Service wird übertragen.

## P4 – WidgetKit

Widget-Extension, gemeinsame Daten über App Groups und geeignete Aktualisierungszyklen umsetzen. Die im Widget sichtbaren Einsatzdaten begrenzen und Zugriff nach Logout beenden. Widgets auf iPhone und iPad testen.

## P5 – Hintergrund-GPS und Universal Links

Vorhandenes Background-Geolocation-Plugin an den aktiven Einsatz anbinden. Standort nur während eines aktiven Einsatzes mit verständlicher Zustimmung übertragen; Hintergrundberechtigung, Energieverbrauch und Beenden des Trackings testen. Die vorbereiteten plist-Texte und `UIBackgroundModes: location` allein starten kein Tracking.

Universal Links: vorbereitet, wartet auf Apple-Account und Team-ID. Associated Domains, URL-Schema und Launch-URL-Auswertung sind vorbereitet; Einrichtung und Tests siehe [Deep Links](deep-links.md). `apple-app-site-association` auf dem Server bereitstellen und Pfade sowie App-ID/Team-ID abstimmen. Launch-URL-Handling bei Kaltstart und laufender App testen. App-bound Domains ersetzen keine Universal-Link-Konfiguration.

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
