import { Linking, View } from 'react-native';
import { useTheme } from '../design/theme';
import { Button } from '../ui/Button';
import { Section } from '../ui/Section';
import { Card } from '../ui/Surface';
import { Text } from '../ui/Text';

/** The phrases compiled into app-intents/WorkoutIntents.swift (each says the app name). */
const PHRASES = [
  "What's my next workout in Greyskull LP?",
  'Start my workout in Greyskull LP',
  'Make me a program in Greyskull LP',
];

/** Settings card on iOS: what to say to Siri, and a way into the Shortcuts app. */
export function SiriCard() {
  const t = useTheme();
  return (
    <Section label="Siri and Shortcuts">
      <Card>
        <View style={{ gap: t.space[1] }}>
          <Text variant="bodyStrong">Ask Siri about your workout</Text>
          <Text variant="callout" color="textMuted">
            Say these, or add them to Shortcuts.
          </Text>
        </View>
        <View style={{ gap: t.space[2], marginTop: t.space[4] }}>
          {PHRASES.map((phrase) => (
            <View
              key={phrase}
              style={{
                backgroundColor: t.color.background,
                borderRadius: t.radius.md,
                paddingHorizontal: t.space[4],
                paddingVertical: t.space[3],
              }}
            >
              <Text variant="callout">{`“${phrase}”`}</Text>
            </View>
          ))}
        </View>
        <View style={{ marginTop: t.space[4] }}>
          <Button
            title="Open in Shortcuts"
            variant="secondary"
            onPress={() => void Linking.openURL('shortcuts://').catch(() => undefined)}
          />
        </View>
      </Card>
    </Section>
  );
}
