import WidgetKit
import SwiftUI

@main
struct EinsatzWidgetBundle: WidgetBundle {
    var body: some Widget {
        EinsatzStatusWidget()
        EinsatzLiveActivityWidget()
        FahrtShortcutWidget()
        KontakteShortcutWidget()
        ObjekteShortcutWidget()
    }
}
