import ActivityKit
import Foundation

@available(iOS 16.2, *)
struct EinsatzActivityAttributes: ActivityAttributes {
    var incidentId: Int
    var url: String

    enum CodingKeys: String, CodingKey {
        case incidentId = "incident_id"
        case url = "url"
    }

    init(incidentId: Int, url: String) {
        self.incidentId = incidentId
        self.url = url
    }

    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        incidentId = (try? values.decode(Int.self, forKey: .incidentId)) ?? 0
        url = (try? values.decode(String.self, forKey: .url)) ?? ""
    }

    struct ContentState: Codable, Hashable {
        var alarmCode: String = ""
        var address: String = ""
        var phaseIndex: Int = 0
        var phaseCount: Int = 1
        var phaseLabel: String = ""
        var startedAt: Double = 0
        var unitCount: Int = 0
        var isExercise: Bool = false
        var ended: Bool = false

        enum CodingKeys: String, CodingKey {
            case alarmCode = "alarm_code"
            case address = "address"
            case phaseIndex = "phase_index"
            case phaseCount = "phase_count"
            case phaseLabel = "phase_label"
            case startedAt = "started_at"
            case unitCount = "unit_count"
            case isExercise = "is_exercise"
            case ended = "ended"
        }

        init() {}

        init(from decoder: Decoder) throws {
            let values = try decoder.container(keyedBy: CodingKeys.self)
            alarmCode = (try? values.decode(String.self, forKey: .alarmCode)) ?? ""
            address = (try? values.decode(String.self, forKey: .address)) ?? ""
            phaseIndex = (try? values.decode(Int.self, forKey: .phaseIndex)) ?? 0
            phaseCount = (try? values.decode(Int.self, forKey: .phaseCount)) ?? 1
            phaseLabel = (try? values.decode(String.self, forKey: .phaseLabel)) ?? ""
            startedAt = (try? values.decode(Double.self, forKey: .startedAt)) ?? 0
            unitCount = (try? values.decode(Int.self, forKey: .unitCount)) ?? 0
            isExercise = (try? values.decode(Bool.self, forKey: .isExercise)) ?? false
            ended = (try? values.decode(Bool.self, forKey: .ended)) ?? false
        }
    }
}
