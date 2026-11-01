import Foundation

// A malformed optional field never discards a sibling field or subtree.
struct DutyState: Codable {
    var serverTime: String?
    var incidentCount: Int?
    var dutyActive: Bool?
    var incident: DutyIncident?
    var myLageQueue: DutyQueue?
    var lage: DutyLage?
    var startDate: Date?

    enum CodingKeys: String, CodingKey {
        case serverTime = "server_time"
        case incidentCount = "incident_count"
        case dutyActive = "duty_active"
        case incident = "incident"
        case myLageQueue = "my_lage_queue"
        case lage = "lage"
    }

    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        serverTime = try? values.decodeIfPresent(String.self, forKey: .serverTime)
        incidentCount = try? values.decodeIfPresent(Int.self, forKey: .incidentCount)
        dutyActive = try? values.decodeIfPresent(Bool.self, forKey: .dutyActive)
        incident = try? values.decodeIfPresent(DutyIncident.self, forKey: .incident)
        myLageQueue = try? values.decodeIfPresent(DutyQueue.self, forKey: .myLageQueue)
        lage = try? values.decodeIfPresent(DutyLage.self, forKey: .lage)
    }

    static func parse(_ data: Data, now: Date) -> DutyState {
        var state = (try? JSONDecoder().decode(DutyState.self, from: data)) ?? DutyState()
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        if let server = state.serverTime.flatMap({ formatter.date(from: $0) }),
           let started = state.incident?.startedAt.flatMap({ formatter.date(from: $0) }) {
            state.startDate = now.addingTimeInterval(-max(0, server.timeIntervalSince(started)))
        }
        return state
    }

    init() {}

    static var example: DutyState {
        let json = #"{"server_time":"2026-01-01T12:10:00Z","incident_count":2,"incident":{"alarm_type_code":"B2","address":"Hauptstraße 12, Musterstadt","url":"/einsatz/12","started_at":"2026-01-01T12:00:00Z","phase_index":1,"phase_count":4,"phase_label":"Anfahrt","meldung":"Rauchentwicklung im Gebäude","objekt":{"name":"Gemeindeamt"}}}"#
        return parse(Data(json.utf8), now: Date(timeIntervalSince1970: 1767269400))
    }
}

struct DutyIncident: Codable {
    var id: Int?
    var url: String?
    var alarmTypeCode: String?
    var address: String?
    var lat: Double?
    var lng: Double?
    var meldung: String?
    var objekt: DutyObject?
    var startedAt: String?
    var isExercise: Bool?
    var phaseIndex: Int?
    var phaseCount: Int?
    var phaseLabel: String?
    var unitCount: Int?

    enum CodingKeys: String, CodingKey {
        case id = "id"
        case url = "url"
        case alarmTypeCode = "alarm_type_code"
        case address = "address"
        case lat = "lat"
        case lng = "lng"
        case meldung = "meldung"
        case objekt = "objekt"
        case startedAt = "started_at"
        case isExercise = "is_exercise"
        case phaseIndex = "phase_index"
        case phaseCount = "phase_count"
        case phaseLabel = "phase_label"
        case unitCount = "unit_count"
    }

    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        id = try? values.decodeIfPresent(Int.self, forKey: .id)
        url = try? values.decodeIfPresent(String.self, forKey: .url)
        alarmTypeCode = try? values.decodeIfPresent(String.self, forKey: .alarmTypeCode)
        address = try? values.decodeIfPresent(String.self, forKey: .address)
        lat = try? values.decodeIfPresent(Double.self, forKey: .lat)
        lng = try? values.decodeIfPresent(Double.self, forKey: .lng)
        meldung = try? values.decodeIfPresent(String.self, forKey: .meldung)
        objekt = try? values.decodeIfPresent(DutyObject.self, forKey: .objekt)
        startedAt = try? values.decodeIfPresent(String.self, forKey: .startedAt)
        isExercise = try? values.decodeIfPresent(Bool.self, forKey: .isExercise)
        phaseIndex = try? values.decodeIfPresent(Int.self, forKey: .phaseIndex)
        phaseCount = try? values.decodeIfPresent(Int.self, forKey: .phaseCount)
        phaseLabel = try? values.decodeIfPresent(String.self, forKey: .phaseLabel)
        unitCount = try? values.decodeIfPresent(Int.self, forKey: .unitCount)
    }
}

struct DutyObject: Codable {
    var id: Int?
    var name: String?
    var url: String?

    enum CodingKeys: String, CodingKey {
        case id = "id"
        case name = "name"
        case url = "url"
    }

    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        id = try? values.decodeIfPresent(Int.self, forKey: .id)
        name = try? values.decodeIfPresent(String.self, forKey: .name)
        url = try? values.decodeIfPresent(String.self, forKey: .url)
    }
}

struct DutyQueue: Codable {
    var lageId: Int?
    var lageName: String?
    var lageUrl: String?
    var einheitUrl: String?
    var isExercise: Bool?
    var current: DutyAssignment?
    var upcoming: [DutyAssignment]?
    var remainingCount: Int?

    enum CodingKeys: String, CodingKey {
        case lageId = "lage_id"
        case lageName = "lage_name"
        case lageUrl = "lage_url"
        case einheitUrl = "einheit_url"
        case isExercise = "is_exercise"
        case current = "current"
        case upcoming = "upcoming"
        case remainingCount = "remaining_count"
    }

    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        lageId = try? values.decodeIfPresent(Int.self, forKey: .lageId)
        lageName = try? values.decodeIfPresent(String.self, forKey: .lageName)
        lageUrl = try? values.decodeIfPresent(String.self, forKey: .lageUrl)
        einheitUrl = try? values.decodeIfPresent(String.self, forKey: .einheitUrl)
        isExercise = try? values.decodeIfPresent(Bool.self, forKey: .isExercise)
        current = try? values.decodeIfPresent(DutyAssignment.self, forKey: .current)
        upcoming = try? values.decodeIfPresent([DutyAssignment].self, forKey: .upcoming)
        remainingCount = try? values.decodeIfPresent(Int.self, forKey: .remainingCount)
    }
}

struct DutyAssignment: Codable {
    var id: Int?
    var bezeichnung: String?
    var meldung: String?
    var address: String?
    var priority: String?
    var phase: String?
    var auftrag: String?
    var einheitStatus: String?
    var einheitUrl: String?

    enum CodingKeys: String, CodingKey {
        case id = "id"
        case bezeichnung = "bezeichnung"
        case meldung = "meldung"
        case address = "address"
        case priority = "priority"
        case phase = "phase"
        case auftrag = "auftrag"
        case einheitStatus = "einheit_status"
        case einheitUrl = "einheit_url"
    }

    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        id = try? values.decodeIfPresent(Int.self, forKey: .id)
        bezeichnung = try? values.decodeIfPresent(String.self, forKey: .bezeichnung)
        meldung = try? values.decodeIfPresent(String.self, forKey: .meldung)
        address = try? values.decodeIfPresent(String.self, forKey: .address)
        priority = try? values.decodeIfPresent(String.self, forKey: .priority)
        phase = try? values.decodeIfPresent(String.self, forKey: .phase)
        auftrag = try? values.decodeIfPresent(String.self, forKey: .auftrag)
        einheitStatus = try? values.decodeIfPresent(String.self, forKey: .einheitStatus)
        einheitUrl = try? values.decodeIfPresent(String.self, forKey: .einheitUrl)
    }
}

struct DutyLage: Codable {
    var name: String?
    var url: String?
    var isExercise: Bool?

    enum CodingKeys: String, CodingKey {
        case name = "name"
        case url = "url"
        case isExercise = "is_exercise"
    }

    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        name = try? values.decodeIfPresent(String.self, forKey: .name)
        url = try? values.decodeIfPresent(String.self, forKey: .url)
        isExercise = try? values.decodeIfPresent(Bool.self, forKey: .isExercise)
    }
}

