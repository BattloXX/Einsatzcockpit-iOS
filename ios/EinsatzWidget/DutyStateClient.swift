import Foundation

func isAllowedBase(_ value: String) -> Bool {
    guard let parts = URLComponents(string: value),
          parts.scheme?.lowercased() == "https",
          let host = parts.host?.lowercased(),
          host == "einsatzcockpit.com" || host.hasSuffix(".einsatzcockpit.com"),
          parts.user == nil, parts.password == nil,
          parts.query == nil, parts.fragment == nil,
          !value.contains("\\") else { return false }
    return parts.url != nil
}

func deepLink(path: String) -> URL? {
    guard path.hasPrefix("/"), !path.hasPrefix("//"), !path.contains("\\"),
          let decoded = path.removingPercentEncoding,
          !decoded.hasPrefix("//"), !decoded.contains("\\"),
          !decoded.unicodeScalars.contains(where: { CharacterSet.controlCharacters.contains($0) }) else { return nil }
    let unreserved = CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~")
    guard let encoded = path.addingPercentEncoding(withAllowedCharacters: unreserved) else { return nil }
    return URL(string: "einsatzcockpit://open?path=" + encoded)
}

struct CachedDutyState: Codable {
    let fetchedAt: Date
    let json: Data
}

struct DutyStateResult {
    let state: DutyState
    let needsLogin: Bool
    let disconnectedAt: Date?
}

// Do not forward device credentials to a redirect destination.
private final class DutyRedirectPolicy: NSObject, URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask,
                    willPerformHTTPRedirection response: HTTPURLResponse,
                    newRequest request: URLRequest,
                    completionHandler: @escaping (URLRequest?) -> Void) {
        completionHandler(nil)
    }
}

enum DutyStateClient {
    static func fetch() async -> DutyStateResult {
        let defaults = UserDefaults(suiteName: SharedKeys.groupId)
        let base = defaults?.string(forKey: SharedKeys.baseUrl) ?? ""
        let token = (defaults?.string(forKey: SharedKeys.deviceToken) ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let invalid = defaults?.string(forKey: SharedKeys.accessInvalid) ?? ""
        guard isAllowedBase(base), !token.isEmpty, invalid.isEmpty,
              defaults?.bool(forKey: SharedKeys.accessInvalid) != true,
              let url = URL(string: base.trimmingCharacters(in: CharacterSet(charactersIn: "/")) + "/api/v1/device/duty-state") else {
            defaults?.removeObject(forKey: SharedKeys.dutyState)
            return DutyStateResult(state: DutyState(), needsLogin: true, disconnectedAt: nil)
        }
        let configuration = URLSessionConfiguration.ephemeral
        configuration.timeoutIntervalForRequest = 15
        configuration.timeoutIntervalForResource = 15
        configuration.httpShouldSetCookies = false
        let session = URLSession(configuration: configuration, delegate: DutyRedirectPolicy(), delegateQueue: nil)
        defer { session.invalidateAndCancel() }
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.timeoutInterval = 15
        request.setValue("Bearer " + token, forHTTPHeaderField: "Authorization")
        request.setValue("XMLHttpRequest", forHTTPHeaderField: "X-Requested-With")
        request.setValue("ios", forHTTPHeaderField: "X-ECP-Platform")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        do {
            let (data, response) = try await session.data(for: request)
            guard let http = response as? HTTPURLResponse else { throw URLError(.badServerResponse) }
            if http.statusCode == 401 || http.statusCode == 403 {
                defaults?.removeObject(forKey: SharedKeys.dutyState)
                if let reason = http.value(forHTTPHeaderField: "X-ECP-Auth-Error") {
                    defaults?.set(reason, forKey: "widget.authFailed")
                }
                return DutyStateResult(state: DutyState(), needsLogin: true, disconnectedAt: nil)
            }
            guard (200..<300).contains(http.statusCode),
                  (try? JSONSerialization.jsonObject(with: data)) is [String: Any] else {
                throw URLError(.badServerResponse)
            }
            let now = Date()
            let cached = CachedDutyState(fetchedAt: now, json: data)
            if let blob = try? JSONEncoder().encode(cached) {
                defaults?.set(blob, forKey: SharedKeys.dutyState)
            }
            defaults?.removeObject(forKey: "widget.authFailed")
            return DutyStateResult(state: DutyState.parse(data, now: now), needsLogin: false, disconnectedAt: nil)
        } catch {
            let now = Date()
            if let blob = defaults?.data(forKey: SharedKeys.dutyState),
               let cache = try? JSONDecoder().decode(CachedDutyState.self, from: blob) {
                return DutyStateResult(state: DutyState.parse(cache.json, now: cache.fetchedAt), needsLogin: false,
                                       disconnectedAt: now.timeIntervalSince(cache.fetchedAt) > 900 ? cache.fetchedAt : nil)
            }
            return DutyStateResult(state: DutyState(), needsLogin: false, disconnectedAt: now)
        }
    }
}
