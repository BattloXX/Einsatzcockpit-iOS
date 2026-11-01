import WidgetKit
import SwiftUI

struct EinsatzStatusEntry: TimelineEntry {
    let date: Date
    let isSignedIn: Bool
}

struct EinsatzStatusProvider: TimelineProvider {
    func placeholder(in context: Context) -> EinsatzStatusEntry {
        entry()
    }

    func getSnapshot(in context: Context, completion: @escaping (EinsatzStatusEntry) -> Void) {
        completion(entry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<EinsatzStatusEntry>) -> Void) {
        completion(Timeline(entries: [entry()], policy: .after(Date().addingTimeInterval(900))))
    }

    private func entry() -> EinsatzStatusEntry {
        let baseUrl = UserDefaults(suiteName: SharedKeys.groupId)?.string(forKey: SharedKeys.baseUrl)
        return EinsatzStatusEntry(date: Date(), isSignedIn: !(baseUrl ?? "").isEmpty)
    }
}

struct EinsatzStatusView: View {
    let entry: EinsatzStatusEntry

    var body: some View {
        if #available(iOS 17.0, *) {
            content.containerBackground(for: .widget) {
                Color(.systemBackground)
            }
        } else {
            content.background(Color(.systemBackground))
        }
    }

    private var content: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Einsatzcockpit").font(.headline)
            Text("Kein Einsatz")
            Text(entry.isSignedIn ? "Angemeldet" : "Anmeldung nötig")
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .padding()
    }
}

struct EinsatzStatusWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "EinsatzStatusWidget", provider: EinsatzStatusProvider()) { entry in
            EinsatzStatusView(entry: entry)
        }
        .configurationDisplayName("Einsatzstatus")
        .description("Zeigt den laufenden Einsatz.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
