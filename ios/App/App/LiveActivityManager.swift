import ActivityKit
import Foundation
import UIKit

// Independent of the Widget target; malformed optional fields use defaults.
struct LiveDutyState {
    let serverTime: String?
    let incident: [String: Any]?

    init?(data: Data) {
        guard let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
              json["incident"] == nil || json["incident"] is NSNull || json["incident"] is [String: Any] else { return nil }
        serverTime = json["server_time"] as? String
        incident = json["incident"] as? [String: Any]
    }
}

private final class LiveActivityRedirectPolicy: NSObject, URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask,
                    willPerformHTTPRedirection response: HTTPURLResponse,
                    newRequest request: URLRequest,
                    completionHandler: @escaping (URLRequest?) -> Void) {
        completionHandler(nil)
    }
}

@available(iOS 16.2, *)
enum LiveActivityManager {
    static func start() {
        Task { @MainActor in LiveActivityService.shared.start() }
    }

    static func syncFromServer() {
        Task { @MainActor in await LiveActivityService.shared.syncFromServer() }
    }

    static func endAll() {
        Task { @MainActor in await LiveActivityService.shared.endAll() }
    }

    static func makeState(from duty: LiveDutyState, now: Date) -> EinsatzActivityAttributes.ContentState? {
        guard let incident = duty.incident else { return nil }
        var state = EinsatzActivityAttributes.ContentState()
        state.alarmCode = incident["alarm_type_code"] as? String ?? ""
        state.address = incident["address"] as? String ?? ""
        state.phaseIndex = incident["phase_index"] as? Int ?? 0
        state.phaseCount = incident["phase_count"] as? Int ?? 1
        state.phaseLabel = incident["phase_label"] as? String ?? ""
        state.unitCount = incident["unit_count"] as? Int ?? 0
        state.isExercise = incident["is_exercise"] as? Bool ?? false
        state.startedAt = now.timeIntervalSince1970
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        if let serverTime = duty.serverTime, let startedAt = incident["started_at"] as? String,
           let server = formatter.date(from: serverTime), let started = formatter.date(from: startedAt) {
            state.startedAt = now.addingTimeInterval(-max(0, server.timeIntervalSince(started))).timeIntervalSince1970
        }
        return state
    }
}

@available(iOS 16.2, *)
@MainActor
private final class LiveActivityService {
    static let shared = LiveActivityService()
    private var started = false
    private var syncing = false
    private var generation = 0
    private var observer: NSObjectProtocol?
    private var activityTask: Task<Void, Never>?
    private var startTask: Task<Void, Never>?
    private var tokenTasks: [String: Task<Void, Never>] = [:]
    private var tokens: [String: String] = [:]
    private var startToken: String?

    private struct Credentials: Equatable {
        let base: String
        let token: String
    }

    private func credentials() -> Credentials? {
        let defaults = UserDefaults.standard
        let base = defaults.string(forKey: "CapacitorStorage.el_base_url") ?? ""
        let token = (defaults.string(forKey: "CapacitorStorage.el_device_token") ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !token.isEmpty, let parts = URLComponents(string: base),
              parts.scheme?.lowercased() == "https", let host = parts.host?.lowercased(),
              host == "einsatzcockpit.com" || host.hasSuffix(".einsatzcockpit.com"),
              parts.user == nil, parts.password == nil, parts.query == nil, parts.fragment == nil,
              !base.contains("\\"), parts.url != nil else { return nil }
        return Credentials(base: base.trimmingCharacters(in: CharacterSet(charactersIn: "/")), token: token)
    }

    func start() {
        guard !started else { return }
        started = true
        for activity in Activity<EinsatzActivityAttributes>.activities { observe(activity) }
        activityTask = Task {
            for await activity in Activity<EinsatzActivityAttributes>.activityUpdates {
                observe(activity)
            }
        }
        if #available(iOS 17.2, *) {
            startTask = Task {
                for await data in Activity<EinsatzActivityAttributes>.pushToStartTokenUpdates {
                    let token = hex(data)
                    startToken = token
                    await report(token: token, incidentId: nil)
                }
            }
        }
        observer = NotificationCenter.default.addObserver(forName: UIApplication.didBecomeActiveNotification,
                                                          object: nil, queue: .main) { _ in
            LiveActivityManager.syncFromServer()
        }
        Task { await syncFromServer() }
    }

    private func hex(_ data: Data) -> String {
        data.map { String(format: "%02x", $0) }.joined()
    }

    private func observe(_ activity: Activity<EinsatzActivityAttributes>) {
        guard tokenTasks[activity.id] == nil else { return }
        tokenTasks[activity.id] = Task {
            for await data in activity.pushTokenUpdates {
                guard !Task.isCancelled else { return }
                let token = hex(data)
                if let old = tokens[activity.id], old != token {
                    await remove(token: old)
                }
                tokens[activity.id] = token
                await report(token: token, incidentId: activity.attributes.incidentId)
            }
        }
    }

    private func request(path: String, method: String, body: [String: Any]?, using auth: Credentials) async -> Data? {
        guard credentials() == auth, let url = URL(string: auth.base + path) else { return nil }
        let configuration = URLSessionConfiguration.ephemeral
        configuration.timeoutIntervalForRequest = 15
        configuration.timeoutIntervalForResource = 15
        configuration.httpShouldSetCookies = false
        let session = URLSession(configuration: configuration, delegate: LiveActivityRedirectPolicy(), delegateQueue: nil)
        defer { session.invalidateAndCancel() }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.timeoutInterval = 15
        request.setValue("Bearer " + auth.token, forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("XMLHttpRequest", forHTTPHeaderField: "X-Requested-With")
        request.setValue("ios", forHTTPHeaderField: "X-ECP-Platform")
        if let body = body { request.httpBody = try? JSONSerialization.data(withJSONObject: body) }
        do {
            let (data, response) = try await session.data(for: request)
            guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode),
                  credentials() == auth else { return nil }
            return data
        } catch { return nil }
    }

    private func report(token: String, incidentId: Int?) async {
        guard let auth = credentials() else { return }
        let epoch = generation
        var body: [String: Any] = ["kind": incidentId == nil ? "start" : "activity", "token": token]
        body["incident_id"] = incidentId.map { $0 as Any } ?? NSNull()
        for attempt in 0..<2 {
            guard !Task.isCancelled, generation == epoch, credentials() == auth else { return }
            if await request(path: "/api/v1/device/live-activity-token", method: "POST", body: body, using: auth) != nil { return }
            if attempt == 0 {
                do { try await Task.sleep(nanoseconds: 5_000_000_000) } catch { return }
            }
        }
    }

    private func remove(token: String) async {
        guard let auth = credentials() else { return }
        _ = await request(path: "/api/v1/device/live-activity-token", method: "DELETE", body: ["token": token], using: auth)
    }

    private func finish(_ activity: Activity<EinsatzActivityAttributes>) async {
        tokenTasks.removeValue(forKey: activity.id)?.cancel()
        let token = tokens.removeValue(forKey: activity.id)
        // Immediate dismissal avoids leaving incident details visible after logout.
        await activity.end(nil, dismissalPolicy: .immediate)
        if let token = token { await remove(token: token) }
    }

    func endAll() async {
        generation += 1
        for activity in Activity<EinsatzActivityAttributes>.activities { await finish(activity) }
    }

    func syncFromServer() async {
        let deviceToken = UserDefaults.standard.string(forKey: "CapacitorStorage.el_device_token") ?? ""
        guard !deviceToken.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            await endAll()
            return
        }
        guard !syncing, let auth = credentials() else { return }
        syncing = true
        defer { syncing = false }
        let epoch = generation
        // Re-send cached tokens after login or a previous network failure.
        if let token = startToken { await report(token: token, incidentId: nil) }
        for activity in Activity<EinsatzActivityAttributes>.activities {
            observe(activity)
            if let token = tokens[activity.id] { await report(token: token, incidentId: activity.attributes.incidentId) }
        }
        guard let data = await request(path: "/api/v1/device/duty-state", method: "GET", body: nil, using: auth),
              let duty = LiveDutyState(data: data), generation == epoch, credentials() == auth else { return }
        guard let incident = duty.incident else {
            await endAll()
            return
        }
        // An incident without an ID must not end an existing activity.
        guard let incidentId = incident["id"] as? Int, incidentId > 0,
              let state = LiveActivityManager.makeState(from: duty, now: Date()) else { return }
        var matching: Activity<EinsatzActivityAttributes>?
        for activity in Activity<EinsatzActivityAttributes>.activities {
            if activity.attributes.incidentId == incidentId, matching == nil {
                matching = activity
            } else {
                await finish(activity)
            }
        }
        guard generation == epoch, credentials() == auth else { return }
        let content = ActivityContent(state: state, staleDate: nil)
        if let activity = matching {
            await activity.update(content)
        } else if ActivityAuthorizationInfo().areActivitiesEnabled {
            let attributes = EinsatzActivityAttributes(incidentId: incidentId, url: incident["url"] as? String ?? "/einsatz/\(incidentId)")
            if let activity = try? Activity<EinsatzActivityAttributes>.request(attributes: attributes, content: content, pushType: .token) {
                observe(activity)
            }
        }
    }
}
