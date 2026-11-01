import WidgetKit
import SwiftUI

struct EinsatzStatusEntry: TimelineEntry {
    let date: Date
    let result: DutyStateResult
}

struct EinsatzStatusProvider: TimelineProvider {
    func placeholder(in context: Context) -> EinsatzStatusEntry {
        example()
    }

    func getSnapshot(in context: Context, completion: @escaping (EinsatzStatusEntry) -> Void) {
        completion(example())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<EinsatzStatusEntry>) -> Void) {
        Task {
            let result = await DutyStateClient.fetch()
            let now = Date()
            let entry = EinsatzStatusEntry(date: now, result: result)
            let interval: TimeInterval = result.state.incident != nil ? 300 : 900
            completion(Timeline(entries: [entry], policy: .after(now.addingTimeInterval(interval))))
        }
    }

    private func example() -> EinsatzStatusEntry {
        EinsatzStatusEntry(date: Date(timeIntervalSince1970: 1767269400),
                           result: DutyStateResult(state: .example, needsLogin: false, disconnectedAt: nil))
    }
}

struct EinsatzStatusView: View {
    @Environment(\.widgetFamily) private var family
    let entry: EinsatzStatusEntry

    private var state: DutyState { entry.result.state }
    private var contentPadding: CGFloat {
        if #available(iOS 17.0, *) { return 0 }
        return 12
    }
    private var exercise: Bool {
        if let incident = state.incident { return incident.isExercise == true }
        if let queue = state.myLageQueue { return queue.isExercise == true }
        return state.lage?.isExercise == true
    }
    private var accent: Color {
        if entry.result.needsLogin { return .primary }
        return exercise ? .orange : (state.incident != nil || state.myLageQueue != nil || state.lage != nil ? .red : .primary)
    }
    private var title: String {
        if entry.result.needsLogin { return "Anmeldung nötig" }
        if let incident = state.incident { return incident.alarmTypeCode ?? "Einsatz" }
        if let queue = state.myLageQueue { return queue.lageName ?? "Großschadenslage" }
        if state.lage != nil { return "Großschadenslage aktiv" }
        return "Kein Einsatz"
    }
    private var address: String {
        if entry.result.needsLogin { return "App öffnen" }
        if let incident = state.incident { return incident.address ?? "" }
        if let queue = state.myLageQueue { return queue.current?.address ?? "" }
        return state.lage?.name ?? (state.dutyActive == true ? "Dienst aktiv" : "")
    }
    private var link: URL? {
        let path: String
        if entry.result.needsLogin { path = "/" }
        else if let incident = state.incident { path = incident.url ?? "/" }
        else if let queue = state.myLageQueue { path = queue.einheitUrl ?? queue.current?.einheitUrl ?? queue.lageUrl ?? "/" }
        else { path = state.lage?.url ?? "/" }
        return deepLink(path: path) ?? deepLink(path: "/")
    }
    private var phaseCount: Int { max(1, state.incident?.phaseCount ?? 4) }
    private var phaseNumber: Int { min(max(0, state.incident?.phaseIndex ?? 0), phaseCount - 1) + 1 }
    private var phaseText: String {
        "Phase \(phaseNumber)/\(phaseCount) – \(state.incident?.phaseLabel ?? "Einsatz läuft")"
    }

    var body: some View {
        if #available(iOS 17.0, *) {
            content.containerBackground(for: .widget) {
                Color(.systemBackground)
            }
        } else {
            content.background(Color(.systemBackground))
        }
    }

    @ViewBuilder private var content: some View {
        if family == .accessoryInline {
            if let date = entry.result.disconnectedAt {
                (Text(inlineText + " · Stand ") + Text(date, style: .time) + Text(" – keine Verbindung"))
                    .widgetURL(link)
            } else {
                Text(inlineText).widgetURL(link)
            }
        } else if family == .accessoryRectangular {
            VStack(alignment: .leading, spacing: 2) {
                Label(exercise ? "ÜBUNG · " + title : title, systemImage: "flame.fill")
                    .font(.headline).lineLimit(1)
                Text(address).lineLimit(1)
                if state.incident != nil && !entry.result.needsLogin {
                    Text(phaseText).font(.caption).lineLimit(1)
                } else if let assignment = state.myLageQueue?.current, !entry.result.needsLogin {
                    Text(assignment.auftrag ?? assignment.bezeichnung ?? "Auftrag öffnen").font(.caption).lineLimit(1)
                }
                connectionHint
            }
            .foregroundColor(accent)
            .widgetURL(link)
        } else {
            VStack(alignment: .leading, spacing: 3) {
                HStack {
                    Text(title).font(.headline).foregroundColor(accent).lineLimit(1).minimumScaleFactor(0.7)
                    if exercise && !entry.result.needsLogin {
                        Text("ÜBUNG").font(.caption2).bold().foregroundColor(.orange)
                    }
                }
                if entry.result.needsLogin {
                    Text("App öffnen").font(.caption)
                } else if state.incident != nil {
                    incidentContent
                } else if let queue = state.myLageQueue {
                    queueContent(queue)
                } else {
                    Text(address).font(.caption).lineLimit(2)
                }
                connectionHint
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
            .padding(contentPadding)
            .widgetURL(link)
        }
    }

    private var inlineText: String {
        var text = (exercise && !entry.result.needsLogin ? "ÜBUNG · " : "") + title
        if !address.isEmpty { text += " · " + address }
        return text
    }

    private var incidentContent: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                Text(address).font(.caption).lineLimit(2)
                Text(phaseText).font(.caption2).lineLimit(2)
                ProgressView(value: Double(phaseNumber) / Double(phaseCount)).tint(accent)
                if let start = state.startDate {
                    Text(start, style: .timer).font(.caption).monospacedDigit()
                }
                if let count = state.incidentCount, count > 1 {
                    Text("+\(count - 1) weitere Einsätze").font(.caption2).foregroundColor(.secondary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            if family == .systemMedium {
                VStack(alignment: .leading, spacing: 3) {
                    if let message = state.incident?.meldung { Text(message).font(.caption).lineLimit(3) }
                    if let name = state.incident?.objekt?.name { Text(name).font(.caption2).lineLimit(2) }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .foregroundColor(accent)
    }

    private func queueContent(_ queue: DutyQueue) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            if let current = queue.current {
                if let name = current.bezeichnung { Text(name).font(.subheadline).lineLimit(1) }
                if let task = current.auftrag { Text(task).font(.caption).lineLimit(2) }
                if let address = current.address { Text(address).font(.caption).lineLimit(2) }
                if let status = current.einheitStatus { Text(status).font(.caption2).lineLimit(1) }
            }
            let sum = max(0, queue.remainingCount ?? 0).addingReportingOverflow(queue.upcoming?.count ?? 0)
            let more = sum.overflow ? Int.max : sum.partialValue
            if more > 0 { Text("+\(more) weitere").font(.caption2) }
        }
        .foregroundColor(accent)
    }

    @ViewBuilder private var connectionHint: some View {
        if let date = entry.result.disconnectedAt {
            (Text("Stand ") + Text(date, style: .time) + Text(" – keine Verbindung"))
                .font(.caption2).foregroundColor(.secondary).lineLimit(1)
        }
    }
}

struct EinsatzStatusWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "EinsatzStatusWidget", provider: EinsatzStatusProvider()) { entry in
            EinsatzStatusView(entry: entry)
        }
        .configurationDisplayName("Einsatzstatus")
        .description("Zeigt den laufenden Einsatz.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular, .accessoryInline])
    }
}
