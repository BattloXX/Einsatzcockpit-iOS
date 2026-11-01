# Entwurf: Critical Alerts Entitlement Request

Vorlage für das Apple-Formular nach Einrichtung des Apple-Developer-Accounts. Vor Einreichung Datenschutzbeschreibung mit dem tatsächlichen Betrieb abgleichen und die von Apple verlangten Kontakt-/Teamdaten ergänzen. Dieser Entwurf enthält keine behaupteten Nutzerzahlen, Referenzorganisationen oder bereits erteilten Genehmigungen.

- App-Name: Einsatzcockpit
- Bundle-ID: `cloud.einsatzleiter.app`
- Nutzergruppe: Feuerwehren und Rettungsorganisationen/BOS; Zugang nur über Organisations-Login.

## English application text

We request the Critical Alerts entitlement for Einsatzcockpit (bundle identifier: cloud.einsatzleiter.app), an operational application for fire departments and rescue organizations. Access is restricted to users authenticated through their organization’s login. The application is intended to deliver emergency call-outs to authorized responders.

Emergency mobilization is time-critical and can support life-saving operations. Responders need an audible alarm when they are called to an incident, including when their iPhone is muted or Do Not Disturb is enabled. A missed or delayed call-out may delay their response. Standard and Time Sensitive notifications do not meet this requirement because they cannot ensure an audible alarm through the mute switch; users may also disable Time Sensitive interruptions in Focus settings.

We intend to use Critical Alerts only for urgent operational call-outs requiring immediate attention, not for routine updates, administrative messages, or marketing. We will request the user’s explicit authorization for Critical Alerts and respect their notification settings. We understand that the entitlement requires Apple’s approval and that delivery cannot be guaranteed.

Privacy is particularly important in emergency operations. Our proposed implementation limits notification content to the minimum needed to identify an urgent call-out and directs users to the authenticated application for further operational details. Access to incident information is restricted to authorized organization members. We intend to avoid patient information and other sensitive personal details in lock-screen notification text. Push tokens are used for notification delivery and associated with the authorized account or device; they are not intended for advertising or tracking. Before release, we will verify the notification payloads, access controls, and privacy disclosures against the deployed system.

Please grant the Critical Alerts entitlement so that, with the user’s consent, Einsatzcockpit can provide an audible emergency call-out even when the device is muted or Do Not Disturb is active.

## Deutsche Kurzfassung

Einsatzcockpit soll berechtigte Angehörige von Feuerwehren und Rettungsorganisationen zeitkritisch alarmieren. Zugang besteht nur über Organisations-Login. Ein Einsatzalarm muss mit Zustimmung des Nutzers auch bei Stumm/Nicht stören hörbar sein; normale und Time-Sensitive-Mitteilungen reichen dafür nicht aus. Critical Alerts sollen ausschließlich dringenden Einsatzalarmierungen dienen. Die geplante Umsetzung minimiert Sperrbildschirmdaten, hält sensible Einsatzdetails hinter der Anmeldung und verwendet Push-Token nur für die Zustellung. Die Angaben sind vor Einreichung mit dem tatsächlichen Betrieb abzugleichen.

Die Genehmigung ist offen. Erst danach folgen Entitlement, gesonderte Nutzerzustimmung, geeignete APNs-Payload und Hardwaretests. Grundlage: [Apple: Critical interruption level](https://developer.apple.com/documentation/usernotifications/unnotificationinterruptionlevel/critical) und [Antragsformular](https://developer.apple.com/contact/request/notifications-critical-alerts-entitlement/).
