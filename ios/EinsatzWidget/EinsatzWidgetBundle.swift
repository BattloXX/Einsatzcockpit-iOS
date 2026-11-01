import WidgetKit
import SwiftUI

@main
struct EinsatzWidgetBundle: WidgetBundle {
    var body: some Widget {
        EinsatzStatusWidget()
        FahrtShortcutWidget()
        KontakteShortcutWidget()
        ObjekteShortcutWidget()
    }
}
