import AppIntents
@preconcurrency import CoreSpotlight
internal import ExpoAppIntents
import Foundation

/// An active, unpaused program, resolved from the catalog the app publishes.
struct ProgramEntity: AppEntity, AppIntentEntityRecordConvertible {
  static let typeDisplayRepresentation: TypeDisplayRepresentation = "Program"
  static let defaultQuery = ProgramQuery()

  var id: String
  @Property(title: "Name") var name: String
  var subtitle: String?
  /// What to say when this program is started (the app works it out, including an open workout of another program).
  var startNote: String?

  var displayRepresentation: DisplayRepresentation {
    if let subtitle {
      return DisplayRepresentation(title: "\(name)", subtitle: "\(subtitle)")
    }
    return DisplayRepresentation(title: "\(name)")
  }

  init(record: AppIntentEntityRecord) {
    id = record.id
    name = record.title
    subtitle = record.subtitle
    startNote = record.metadata["start"]
  }
}

@available(iOS 18.0, *)
extension ProgramEntity: IndexedEntity {
  var attributeSet: CSSearchableItemAttributeSet {
    let attributes = CSSearchableItemAttributeSet(contentType: .text)
    attributes.title = name
    attributes.displayName = name
    return attributes
  }
}

struct ProgramQuery: EntityStringQuery {
  func entities(for identifiers: [String]) async throws -> [ProgramEntity] {
    try await AppIntentEntityStore.shared
      .entities(ofKind: SnapshotKind.program, matching: identifiers)
      .map(ProgramEntity.init(record:))
  }

  func suggestedEntities() async throws -> [ProgramEntity] {
    try await AppIntentEntityStore.shared.entities(ofKind: SnapshotKind.program)
      .map(ProgramEntity.init(record:))
  }

  func entities(matching string: String) async throws -> [ProgramEntity] {
    let search = string.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !search.isEmpty else { return [] }
    return try await suggestedEntities().filter {
      $0.name.range(of: search, options: [.caseInsensitive, .diacriticInsensitive]) != nil
    }
  }
}
