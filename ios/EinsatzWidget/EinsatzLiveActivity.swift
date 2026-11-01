import ActivityKit
import SwiftUI
import WidgetKit

@available(iOS 16.2, *)
struct EinsatzLiveActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: EinsatzActivityAttributes.self) { context in
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text(context.state.alarmCode).font(.largeTitle.bold())
                    if context.state.isExercise {
                        Text("ÜBUNG").font(.caption.bold()).padding(4).background(Color.orange).cornerRadius(4)
                    }
                    Spacer()
                    EinsatzActivityTimer(state: context.state)
                }
                Text(context.state.address).lineLimit(2)
                EinsatzActivityPhase(state: context.state)
            }
            .padding()
            .widgetURL(deepLink(path: context.attributes.url))
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Text(context.state.alarmCode).font(.headline)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    EinsatzActivityTimer(state: context.state)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading) {
                        Text(context.state.address).lineLimit(2)
                        EinsatzActivityPhase(state: context.state)
                    }
                }
            } compactLeading: {
                Image(systemName: "flame.fill").foregroundColor(.red)
            } compactTrailing: {
                EinsatzActivityTimer(state: context.state).font(.caption).frame(maxWidth: 64).lineLimit(1)
            } minimal: {
                Image(systemName: "flame.fill").foregroundColor(.red)
            }
            .widgetURL(deepLink(path: context.attributes.url))
            .keylineTint(.red)
        }
    }
}

@available(iOS 16.2, *)
private struct EinsatzActivityTimer: View {
    let state: EinsatzActivityAttributes.ContentState

    var body: some View {
        if state.ended {
            Text("Einsatz beendet")
        } else {
            Text(Date(timeIntervalSince1970: state.startedAt), style: .timer).monospacedDigit()
        }
    }
}

@available(iOS 16.2, *)
private struct EinsatzActivityPhase: View {
    let state: EinsatzActivityAttributes.ContentState

    private var count: Int { max(1, state.phaseCount) }
    private var number: Int { min(count - 1, max(0, state.phaseIndex)) + 1 }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            ProgressView(value: Double(number) / Double(count)).tint(.red)
            Text("Phase \(number)/\(count) – \(state.phaseLabel)").font(.caption)
        }
    }
}
