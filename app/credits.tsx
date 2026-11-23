import { Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ListRow } from '../src/ui/ListRow';
import { ScreenScroll } from '../src/ui/layout';
import { Section } from '../src/ui/Section';
import { Text } from '../src/ui/Text';

const FREE_EXERCISE_DB = 'https://github.com/yuhonas/free-exercise-db';
const UNLICENSE = 'https://unlicense.org/';

/** Attribution for the background photos whose licence asks for it; the full table is in assets/CREDITS.md. */
const PHOTO_CREDITS = [
  '"Close-up Hand holding dumbbell in gym" and "Young man using a leg press machine at the gym" by Nenad Stojkovic, CC BY 2.0, via Wikimedia Commons.',
  'Cable machine and incline bench photos by Rashed Hossain, and the lat pulldown photo by Teddyhtsai, all CC0.',
];

export default function Credits() {
  return (
    <ScreenScroll gap={10}>
      <Stack.Screen options={{ title: 'Credits' }} />
      <Section label="Exercise library">
        <Text>
          The names, equipment, muscles and levels of most exercises come from free-exercise-db, a dataset
          that declares the Unlicense. Only those facts are used. None of its text or images are in the app.
        </Text>
        <Text color="textMuted">
          The descriptions of imported exercises are generated from those facts. The form tips of the original
          lifts are from earlier versions of this app, and the calisthenics exercises were written for it.
        </Text>
        <Text color="textMuted">
          No exercise photos ship with the app: exercises are drawn as line pictograms.
        </Text>
      </Section>
      <Section card>
        <ListRow
          title="free-exercise-db"
          subtitle="github.com/yuhonas/free-exercise-db"
          accessory="chevron"
          onPress={() => void WebBrowser.openBrowserAsync(FREE_EXERCISE_DB).catch(() => undefined)}
        />
        <ListRow
          title="Unlicense"
          subtitle="unlicense.org"
          accessory="chevron"
          onPress={() => void WebBrowser.openBrowserAsync(UNLICENSE).catch(() => undefined)}
        />
      </Section>
      <Section label="Pictograms">
        <Text>The exercise pictograms are line drawings made for this app.</Text>
      </Section>
      <Section label="Screen backgrounds">
        <Text color="textMuted">
          Some screens show a blurred photo behind the header. These photos are cropped, blurred and darkened
          versions of the ones below. The photos behind the other screens come from an earlier version of the
          app, and where they came from is not documented yet.
        </Text>
        {PHOTO_CREDITS.map((line) => (
          <Text key={line} color="textMuted">
            {line}
          </Text>
        ))}
      </Section>
    </ScreenScroll>
  );
}
