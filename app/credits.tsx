import { Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ListRow } from '../src/ui/ListRow';
import { ScreenScroll } from '../src/ui/layout';
import { Section } from '../src/ui/Section';
import { Text } from '../src/ui/Text';

const FREE_EXERCISE_DB = 'https://github.com/yuhonas/free-exercise-db';
const UNLICENSE = 'https://unlicense.org/';

/** Attribution for exercise photos under licences that require it; full list in assets/CREDITS.md. */
const PHOTO_CREDITS = [
  '"Close-up Hand holding dumbbell in gym" and "Young man using a leg press machine at the gym" by Nenad Stojkovic, CC BY 2.0, via Wikimedia Commons.',
  'Cable machine and bench photos by Rashed Hossain and lat pulldown photo by Teddyhtsai, CC0.',
  'Photos are cropped, blurred and recoloured.',
];

export default function Credits() {
  return (
    <ScreenScroll gap={10}>
      <Stack.Screen options={{ title: 'Credits' }} />
      <Section label="Exercise library">
        <Text>
          The names, equipment, muscles and levels of most exercises come from free-exercise-db, which is
          released under the Unlicense (public domain). Only those facts are used; none of its text or images
          are in the app.
        </Text>
        <Text color="textMuted">
          The descriptions of imported exercises are generated from those facts. The form tips and
          descriptions of the lifts and calisthenics exercises written for this app are its own.
        </Text>
      </Section>
      <Section card>
        <ListRow
          title="free-exercise-db"
          subtitle="github.com/yuhonas/free-exercise-db"
          accessory="chevron"
          onPress={() => void WebBrowser.openBrowserAsync(FREE_EXERCISE_DB)}
        />
        <ListRow
          title="Unlicense"
          subtitle="unlicense.org"
          accessory="chevron"
          onPress={() => void WebBrowser.openBrowserAsync(UNLICENSE)}
        />
      </Section>
      <Section label="Pictograms">
        <Text>The exercise pictograms are line drawings made for this app.</Text>
      </Section>
      <Section label="Photos">
        {PHOTO_CREDITS.map((line) => (
          <Text key={line} color="textMuted">
            {line}
          </Text>
        ))}
      </Section>
    </ScreenScroll>
  );
}
