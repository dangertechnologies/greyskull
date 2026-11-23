import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Linking, Platform, TextInput, View } from 'react-native';
import { Pill } from '../../src/components/ProgramBits';
import { useTheme } from '../../src/design/theme';
import type { CustomPlan } from '../../src/domain';
import { getLadder } from '../../src/domain/ladders';
import {
  checkModel,
  downloadModel,
  type Failure,
  generatePlan,
  type ModelStatus,
} from '../../src/generate/model';
import { MAX_TEXT } from '../../src/generate/prompt';
import { DEFAULT_ANSWERS, decodeAnswers, GOAL_LABELS } from '../../src/generate/recommend';
import { useStore } from '../../src/store';
import { Button } from '../../src/ui/Button';
import { Icon } from '../../src/ui/Icon';
import { ListRow } from '../../src/ui/ListRow';
import { BottomBar, ScreenScroll } from '../../src/ui/layout';
import { Section } from '../../src/ui/Section';
import { Card } from '../../src/ui/Surface';
import { Text } from '../../src/ui/Text';

type Phase =
  | { kind: 'checking' }
  | { kind: 'model'; status: ModelStatus }
  | { kind: 'generating' }
  | { kind: 'failed'; failure: Exclude<Failure, 'cancelled'>; errors: string[] }
  | { kind: 'done'; plan: CustomPlan };

/** Why the text box is unavailable, one line each. */
function unsupportedText(reason: string): string {
  if (reason === 'unsupported-os' || reason === 'unsupported-os-version')
    return Platform.OS === 'ios'
      ? 'The on-device model needs iOS 26 or later.'
      : 'This Android version has no on-device model.';
  if (reason === 'unsupported-device')
    return 'This phone does not support Apple Intelligence, which the on-device model needs.';
  if (reason === 'module-unavailable') return 'This build of the app does not include the on-device model.';
  if (reason === 'unsupported-language') return 'The on-device model does not support your language.';
  return 'This phone has no on-device model that the app can use.';
}

const FAILURES: Record<Exclude<Failure, 'cancelled'>, { title: string; body: string }> = {
  timeout: {
    title: 'Timed out',
    body: 'The model took longer than 30 seconds. Try again, perhaps with a shorter description.',
  },
  refused: {
    title: 'The model declined',
    body: 'The on-device model would not answer this request. Try describing it differently.',
  },
  invalid: {
    title: 'The program did not check out',
    body: 'Even after one retry, the model’s program broke these rules:',
  },
  background: {
    title: 'Stopped in the background',
    body: 'The system stops the model when the app leaves the screen. Keep the app open and try again.',
  },
  unavailable: {
    title: 'The model is no longer available',
    body: 'The on-device model stopped being available while it worked. Check again in a moment.',
  },
  error: { title: 'Something went wrong', body: 'The on-device model could not finish.' },
};

/** The text box, on-device model only: drafts a custom program, checks it, and opens it in the builder. */
export default function GenerateDescribe() {
  const t = useTheme();
  const { a } = useLocalSearchParams<{ a?: string }>();
  const owned = useStore((s) => s.equipment);
  const exercises = useStore((s) => s.exercises);
  const customPlans = useStore((s) => s.customPlans);
  const programs = useStore((s) => s.programs);
  const saveCustomPlan = useStore((s) => s.saveCustomPlan);
  const [answers] = useState(() => (a ? decodeAnswers(a) : { ...DEFAULT_ANSWERS, equipment: [...owned] }));
  const [text, setText] = useState('');
  const [phase, setPhase] = useState<Phase>({ kind: 'checking' });
  const [progress, setProgress] = useState<number | null>(null);
  const abort = useRef<AbortController | null>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const check = useCallback(async () => {
    setPhase({ kind: 'checking' });
    setPhase({ kind: 'model', status: await checkModel() });
  }, []);

  useEffect(() => {
    void check();
    // Back from system Settings (Apple Intelligence turned on) or after a download: look again.
    const sub = AppState.addEventListener('change', (state) => {
      const p = phaseRef.current;
      if (state === 'active' && p.kind === 'model' && p.status.kind !== 'ready') void check();
    });
    return () => {
      sub.remove();
      abort.current?.abort();
    };
  }, [check]);

  const generate = async () => {
    const controller = new AbortController();
    abort.current = controller;
    setPhase({ kind: 'generating' });
    const outcome = await generatePlan({
      answers,
      text,
      exercises,
      taken: {
        ids: customPlans.map((p) => p.id),
        names: [...customPlans.map((p) => p.name), ...programs.map((p) => p.name)],
      },
      signal: controller.signal,
    });
    if (abort.current !== controller) return;
    abort.current = null;
    if (outcome.ok) setPhase({ kind: 'done', plan: outcome.plan });
    else if (outcome.failure === 'cancelled') setPhase({ kind: 'model', status: { kind: 'ready' } });
    else setPhase({ kind: 'failed', failure: outcome.failure, errors: outcome.errors });
  };

  const cancel = () => {
    abort.current?.abort();
    abort.current = null;
    setPhase({ kind: 'model', status: { kind: 'ready' } });
  };

  const review = (plan: CustomPlan) => {
    try {
      saveCustomPlan(plan);
    } catch (e) {
      setPhase({
        kind: 'failed',
        failure: 'invalid',
        errors: String(e instanceof Error ? e.message : e).split('\n'),
      });
      return;
    }
    // Opened for review only: the user starts it from the builder or the program list.
    router.replace(`/builder/${plan.id}`);
  };

  const questions = () => (router.canGoBack() ? router.back() : router.replace('/generate'));

  if (phase.kind === 'done')
    return (
      <Preview
        plan={phase.plan}
        goal={GOAL_LABELS[answers.goal]}
        owned={answers.equipment.length > 0}
        onReview={review}
        onDiscard={() => setPhase({ kind: 'model', status: { kind: 'ready' } })}
      />
    );

  const status = phase.kind === 'model' ? phase.status : null;
  const ready = status?.kind === 'ready' || (phase.kind === 'failed' && phase.failure !== 'unavailable');
  const generating = phase.kind === 'generating';
  const unavailable = status !== null && status.kind !== 'ready';

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: 'Describe it' }} />
      <ScreenScroll withBottomBar gap={6}>
        <Text color="textMuted">
          Tell the on-device model what you want. It runs on this phone, so nothing is sent anywhere.
        </Text>
        {phase.kind === 'checking' ? (
          <Text color="textMuted" accessibilityLiveRegion="polite">
            Checking the on-device model…
          </Text>
        ) : null}
        {ready ? (
          <View style={{ flexDirection: 'row', gap: t.space[2] }}>
            <Pill label="Model ready" tone="success" />
            <Pill label="On-device" />
          </View>
        ) : null}
        <View style={{ gap: t.space[2] }}>
          <TextInput
            testID="describe-text"
            accessibilityLabel="Describe the program you want"
            accessibilityHint={`At most ${MAX_TEXT} characters`}
            placeholder="Describe the program you want"
            placeholderTextColor={t.color.textMuted}
            value={text}
            onChangeText={(v) => setText(v.slice(0, MAX_TEXT))}
            maxLength={MAX_TEXT}
            multiline
            editable={ready && !generating}
            maxFontSizeMultiplier={1.6}
            style={[
              t.type.body,
              {
                minHeight: 160,
                color: t.color.text,
                backgroundColor: t.color.surface,
                borderRadius: t.radius.xl,
                borderWidth: 1,
                borderColor: ready ? t.color.borderStrong : t.color.border,
                padding: t.space[4],
                textAlignVertical: 'top',
                opacity: ready && !generating ? 1 : 0.6,
              },
            ]}
          />
          {ready ? (
            <View style={{ flexDirection: 'row', gap: t.space[3] }}>
              <Text variant="callout" color="textMuted" style={{ flex: 1 }}>
                Be specific about days, time and equipment
              </Text>
              <Text
                variant="callout"
                color="textMuted"
                accessibilityLabel={`${text.length} of ${MAX_TEXT} characters`}
              >
                {`${text.length} / ${MAX_TEXT}`}
              </Text>
            </View>
          ) : null}
        </View>

        {unavailable && status ? (
          <Unavailable
            status={status}
            progress={progress}
            onCheck={check}
            onDownload={async () => {
              setPhase({ kind: 'model', status: await downloadModel(setProgress) });
            }}
          />
        ) : null}

        {generating ? (
          <Card>
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: t.space[3] }}
              accessibilityLiveRegion="polite"
            >
              <ActivityIndicator color={t.color.accent} />
              <Text style={{ flex: 1 }}>
                Writing your program on this phone. This can take up to 30 seconds.
              </Text>
            </View>
          </Card>
        ) : null}

        {phase.kind === 'failed' ? (
          <Card>
            <View style={{ gap: t.space[2] }} accessibilityLiveRegion="polite">
              <Text variant="headline">{FAILURES[phase.failure].title}</Text>
              <Text>
                {phase.failure === 'error' && phase.errors[0]
                  ? phase.errors[0]
                  : FAILURES[phase.failure].body}
              </Text>
              {phase.failure === 'invalid'
                ? phase.errors.map((e) => (
                    <Text key={e} variant="callout" color="textMuted">
                      {`• ${e}`}
                    </Text>
                  ))
                : null}
            </View>
          </Card>
        ) : null}

        {ready && !generating ? (
          <View style={{ flexDirection: 'row', gap: t.space[3] }}>
            <Icon name="guide" size={20} color="textMuted" />
            <Text variant="callout" color="textMuted" style={{ flex: 1 }}>
              It picks from exercises and ladders in the library, then you review everything in the builder.
              Nothing starts on its own.
            </Text>
          </View>
        ) : null}
      </ScreenScroll>
      <BottomBar>
        {generating ? (
          <Button title="Cancel" size="lg" variant="secondary" testID="describe-cancel" onPress={cancel} />
        ) : phase.kind === 'failed' && phase.failure === 'unavailable' ? (
          <Button title="Check again" size="lg" onPress={check} />
        ) : ready ? (
          <Button
            title={phase.kind === 'failed' ? 'Try again' : 'Generate'}
            size="lg"
            testID="describe-generate"
            disabled={text.trim().length === 0}
            accessibilityHint={text.trim().length === 0 ? 'Describe the program first' : undefined}
            onPress={generate}
          />
        ) : (
          <Button title="Answer the questions" size="lg" testID="describe-questions" onPress={questions} />
        )}
        {ready && !generating ? (
          <Button title="Answer questions instead" variant="plain" onPress={questions} />
        ) : null}
        {status?.kind === 'disabled' ? (
          <Button
            title="Open system Settings"
            variant="plain"
            onPress={() => void Linking.openSettings().catch(() => undefined)}
          />
        ) : null}
      </BottomBar>
    </View>
  );
}

function Unavailable({
  status,
  progress,
  onCheck,
  onDownload,
}: {
  status: Exclude<ModelStatus, { kind: 'ready' }>;
  progress: number | null;
  onCheck(): void;
  onDownload(): void;
}) {
  const t = useTheme();
  const shown = status.kind === 'downloading' ? (progress ?? status.progress) : null;
  const body =
    status.kind === 'disabled'
      ? 'Apple Intelligence is turned off. Turn it on in system Settings, under Apple Intelligence and Siri, to describe a program in your own words.'
      : status.kind === 'downloading'
        ? `The on-device model is still downloading${shown === null ? '' : ` (${Math.round(shown * 100)} %)`}. You can use it once it is ready.`
        : unsupportedText(status.reason);
  return (
    <Card>
      <View style={{ gap: t.space[3] }} accessibilityLiveRegion="polite">
        <Text variant="headline">
          {status.kind === 'downloading' ? 'Getting the model ready' : 'Not available right now'}
        </Text>
        <Text testID="describe-reason">{body}</Text>
        <Text variant="callout" color="textMuted">
          The questions work on any device, and nothing here needs an account or a network.
        </Text>
        {status.kind === 'downloading' ? (
          <View style={{ gap: t.space[2] }}>
            {status.canDownload ? (
              <Button title="Download the model" variant="secondary" onPress={onDownload} />
            ) : null}
            <Button title="Check again" variant="plain" onPress={onCheck} />
          </View>
        ) : null}
      </View>
    </Card>
  );
}

/** The checked program before anything is saved: days, the checks it passed, Review in builder or Discard. */
function Preview({
  plan,
  goal,
  owned,
  onReview,
  onDiscard,
}: {
  plan: CustomPlan;
  goal: string;
  owned: boolean;
  onReview(plan: CustomPlan): void;
  onDiscard(): void;
}) {
  const t = useTheme();
  const exercises = useStore((s) => s.exercises);
  const label = (slot: CustomPlan['program']['days'][number]['slots'][number]) => {
    if (slot.ladder) return getLadder(slot.ladder)?.name ?? slot.ladder;
    const id = typeof slot.exercise === 'string' ? slot.exercise : slot.exercise[0];
    return exercises[id]?.name ?? id;
  };
  const checks = [
    'Every exercise exists in the library',
    'Every ladder step and scheme is valid',
    owned ? 'Only equipment you own' : 'Equipment not set, so any equipment may appear',
  ];
  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: plan.name }} />
      <ScreenScroll withBottomBar gap={6}>
        <View style={{ flexDirection: 'row', gap: t.space[2] }}>
          <Pill label={goal} />
          <Pill label="Made on this device" tone="success" />
        </View>
        <Text color="textMuted">{plan.summary}</Text>
        <Section card>
          {plan.program.days.map((day, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: days are positional and may share a name
            <ListRow key={`${i}:${day.name}`} title={day.name} subtitle={day.slots.map(label).join(' · ')} />
          ))}
        </Section>
        <Card>
          <View style={{ gap: t.space[3] }}>
            {checks.map((c) => (
              <View key={c} style={{ flexDirection: 'row', gap: t.space[3], alignItems: 'center' }}>
                <Icon name="do" size={20} color="success" />
                <Text style={{ flex: 1 }}>{c}</Text>
              </View>
            ))}
          </View>
        </Card>
      </ScreenScroll>
      <BottomBar>
        <Button title="Review in builder" size="lg" testID="describe-review" onPress={() => onReview(plan)} />
        <Button title="Discard" variant="destructive" testID="describe-discard" onPress={onDiscard} />
      </BottomBar>
    </View>
  );
}
