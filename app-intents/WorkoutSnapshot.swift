internal import ExpoAppIntents

/// Catalog kinds the app publishes from JavaScript (src/intents/snapshot.ts uses the same strings).
enum SnapshotKind {
  /// One entity per active, unpaused program.
  static let program = "program"
  /// One entity, id `next`: the spoken answer for the next workout and the line said when starting it.
  static let next = "nextWorkout"
}

enum WorkoutSnapshot {
  /// A text field of the next-workout record, or nil before the app has published one.
  static func nextText(_ key: String) async -> String? {
    let records = try? await AppIntentEntityStore.shared.entities(ofKind: SnapshotKind.next)
    let value = records?.first?.metadata[key]
    return value?.isEmpty == false ? value : nil
  }
}
