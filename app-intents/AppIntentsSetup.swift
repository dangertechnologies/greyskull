import AppIntents
internal import ExpoAppIntents
internal import ExpoModulesCore

/// Registered Expo inline module that wires app-target App Intents code to expo-app-intents.
/// Do not change the name of this class.
final class AppIntentsSetup: Module {
  public func definition() -> ExpoModulesCore.ModuleDefinition {
    Name("AppIntentsSetup")

    OnCreate {
      Task {
        await AppIntentDispatcher.shared.setShortcutsRefreshHandler {
          GreyskullShortcuts.updateAppShortcutParameters()
        }
        GreyskullShortcuts.updateAppShortcutParameters()
      }
      // Program names only go into Spotlight (iOS 18 and later).
      if #available(iOS 18.0, *) {
        AppEntityIdentifierRegistry.shared.registerIndexed(SnapshotKind.program, as: ProgramEntity.self)
      }
    }
  }
}
