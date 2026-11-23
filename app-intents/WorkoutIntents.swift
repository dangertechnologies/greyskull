import AppIntents
internal import ExpoAppIntents

/// Reads the next workout aloud. Answers from the snapshot the app last published, so the app does not open.
struct NextWorkoutIntent: AppIntent {
  /// Spoken program names and weights need an unlocked device.
  static var authenticationPolicy: IntentAuthenticationPolicy { .requiresAuthentication }
  static let title: LocalizedStringResource = "What's my next workout?"
  static let description = IntentDescription("Tells you your next workout with the weights.")
  static let openAppWhenRun: Bool = false

  func perform() async throws -> some IntentResult & ReturnsValue<String> & ProvidesDialog {
    let text =
      await WorkoutSnapshot.nextText("text")
      ?? "Open Greyskull LP once, so it can read out your next workout."
    return .result(value: text, dialog: IntentDialog(stringLiteral: text))
  }
}

/// Opens the app on a workout. The program is optional: without one the app picks the workout in
/// progress, else the first program that is not paused (the same pick as the widget).
struct StartWorkoutIntent: AppIntent {
  /// Spoken program names and weights need an unlocked device.
  static var authenticationPolicy: IntentAuthenticationPolicy { .requiresAuthentication }
  static let title: LocalizedStringResource = "Start my workout"
  static let description = IntentDescription("Opens your workout in Greyskull LP.")
  static let openAppWhenRun: Bool = true

  @Parameter(title: "Program")
  var program: ProgramEntity?

  static var parameterSummary: some ParameterSummary {
    Summary("Start \(\.$program)")
  }

  @MainActor
  func perform() async throws -> some IntentResult & ProvidesDialog {
    let note: String
    var params: AppIntentParams = [:]
    if let program {
      params["programId"] = .string(program.id)
      note = program.startNote ?? "Opening \(program.name)."
    } else {
      note = await WorkoutSnapshot.nextText("start") ?? "Opening Greyskull LP."
    }
    await AppIntentDispatcher.shared.dispatch(name: "startWorkout", params: params)
    return .result(dialog: IntentDialog(stringLiteral: note))
  }
}

/// Opens the "Describe it" screen with the words prefilled. The program is written in the app, in the foreground.
struct MakeProgramIntent: AppIntent {
  /// Spoken program names and weights need an unlocked device.
  static var authenticationPolicy: IntentAuthenticationPolicy { .requiresAuthentication }
  static let title: LocalizedStringResource = "Make me a program"
  static let description = IntentDescription("Opens Greyskull LP to write a program from your description.")
  static let openAppWhenRun: Bool = true

  @Parameter(title: "Description", requestValueDialog: "What kind of program do you want?")
  var text: String

  static var parameterSummary: some ParameterSummary {
    Summary("Make me a program: \(\.$text)")
  }

  @MainActor
  func perform() async throws -> some IntentResult & ProvidesDialog {
    await AppIntentDispatcher.shared.dispatch(name: "makeProgram", params: ["text": .string(text)])
    return .result(dialog: "Opening Greyskull LP to write your program.")
  }
}

struct GreyskullShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: NextWorkoutIntent(),
      phrases: [
        "What's my next workout in \(.applicationName)",
        "What is my next workout in \(.applicationName)",
        "Next workout in \(.applicationName)",
      ],
      shortTitle: "Next workout",
      systemImageName: "figure.strengthtraining.traditional"
    )
    AppShortcut(
      intent: StartWorkoutIntent(),
      phrases: [
        "Start my workout in \(.applicationName)",
        "Start my \(.applicationName) workout",
        "Start \(\.$program) in \(.applicationName)",
      ],
      shortTitle: "Start workout",
      systemImageName: "play.fill"
    )
    AppShortcut(
      intent: MakeProgramIntent(),
      phrases: [
        "Make me a program in \(.applicationName)",
        "Make a program in \(.applicationName)",
      ],
      shortTitle: "Make a program",
      systemImageName: "sparkles"
    )
  }
}
