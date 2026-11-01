import Foundation
import UIKit
import WidgetKit

enum SharedCredentialSync {
    static let groupId = SharedKeys.groupId
    private static var observers: [NSObjectProtocol] = []

    static func sync() {
        guard let shared = UserDefaults(suiteName: groupId) else { return }
        let defaults = UserDefaults.standard
        let token = defaults.string(forKey: "CapacitorStorage.el_device_token")
        let deviceToken = token == "" ? nil : token
        let values: [(String, String?)] = [
            (SharedKeys.baseUrl, defaults.string(forKey: "CapacitorStorage.el_base_url")),
            (SharedKeys.deviceToken, deviceToken),
            (SharedKeys.accessInvalid, defaults.string(forKey: "CapacitorStorage.ec_device_access_invalid"))
        ]
        var changed = false
        for (key, value) in values {
            if let value = value {
                if shared.string(forKey: key) != value {
                    shared.set(value, forKey: key)
                    changed = true
                }
            } else if shared.object(forKey: key) != nil {
                shared.removeObject(forKey: key)
                changed = true
            }
        }
        if deviceToken == nil {
            if #available(iOS 16.2, *) { LiveActivityManager.endAll() }
            if shared.object(forKey: SharedKeys.dutyState) != nil {
                shared.removeObject(forKey: SharedKeys.dutyState)
                changed = true
            }
        }
        if changed {
            shared.set(Date().timeIntervalSince1970, forKey: SharedKeys.updatedAt)
            WidgetCenter.shared.reloadAllTimelines()
        }
    }

    static func start() {
        guard observers.isEmpty else { return }
        // JS-Preferences-Änderungen können hier keinen synchronen Sync auslösen.
        // Deshalb beim Start sowie bei Aktivierung und Hintergrundwechsel synchronisieren.
        for name in [UIApplication.didBecomeActiveNotification, UIApplication.didEnterBackgroundNotification] {
            observers.append(NotificationCenter.default.addObserver(forName: name, object: nil, queue: .main) { _ in
                sync()
            })
        }
        sync()
    }
}
