import WidgetKit
import SwiftUI

struct ShortcutDefinition {
    let kind: String
    let title: String
    let description: String
    let symbol: String
    let path: String

    static let kontakte = ShortcutDefinition(kind: "KontakteShortcutWidget", title: "Kontakte",
        description: "Öffnet die Kontakte.", symbol: "person.2.fill", path: "/kontakte")
    static let objekte = ShortcutDefinition(kind: "ObjekteShortcutWidget", title: "Objekte",
        description: "Öffnet die Objekte.", symbol: "building.2.fill", path: "/objekte/")
    static let fahrt = ShortcutDefinition(kind: "FahrtShortcutWidget", title: "Fahrt erfassen",
        description: "Öffnet die Fahrterfassung.", symbol: "car.fill", path: "/fahrtenbuch/neu")
}

struct ShortcutEntry: TimelineEntry {
    let date: Date
}

struct ShortcutProvider: TimelineProvider {
    func placeholder(in context: Context) -> ShortcutEntry {
        ShortcutEntry(date: Date())
    }

    func getSnapshot(in context: Context, completion: @escaping (ShortcutEntry) -> Void) {
        completion(ShortcutEntry(date: Date()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<ShortcutEntry>) -> Void) {
        completion(Timeline(entries: [ShortcutEntry(date: Date())], policy: .never))
    }
}

struct ShortcutView: View {
    @Environment(\.widgetFamily) private var family
    let definition: ShortcutDefinition

    private var contentPadding: CGFloat {
        if #available(iOS 17.0, *) { return 0 }
        return family == .systemSmall ? 12 : 0
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

    private var content: some View {
        Group {
            if family == .accessoryRectangular {
                HStack(spacing: 8) {
                    symbol.font(.system(size: 32))
                    title.font(.headline)
                }
            } else {
                VStack(spacing: family == .accessoryCircular ? 2 : 8) {
                    symbol.font(.system(size: family == .accessoryCircular ? 22 : 36))
                    title.font(family == .accessoryCircular ? .caption2 : .headline)
                        .multilineTextAlignment(.center)
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(contentPadding)
        .widgetURL(deepLink(path: definition.path))
    }

    private var symbol: some View {
        Image(systemName: definition.symbol).accessibilityHidden(true)
    }

    private var title: some View {
        Text(definition.title).lineLimit(2).minimumScaleFactor(0.7)
    }
}

struct KontakteShortcutWidget: Widget {
    private let definition = ShortcutDefinition.kontakte

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: definition.kind, provider: ShortcutProvider()) { _ in
            ShortcutView(definition: definition)
        }
        .configurationDisplayName(definition.title)
        .description(definition.description)
        .supportedFamilies([.systemSmall, .accessoryCircular, .accessoryRectangular])
    }
}

struct ObjekteShortcutWidget: Widget {
    private let definition = ShortcutDefinition.objekte

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: definition.kind, provider: ShortcutProvider()) { _ in
            ShortcutView(definition: definition)
        }
        .configurationDisplayName(definition.title)
        .description(definition.description)
        .supportedFamilies([.systemSmall, .accessoryCircular, .accessoryRectangular])
    }
}

struct FahrtShortcutWidget: Widget {
    private let definition = ShortcutDefinition.fahrt

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: definition.kind, provider: ShortcutProvider()) { _ in
            ShortcutView(definition: definition)
        }
        .configurationDisplayName(definition.title)
        .description(definition.description)
        .supportedFamilies([.systemSmall, .accessoryCircular, .accessoryRectangular])
    }
}
