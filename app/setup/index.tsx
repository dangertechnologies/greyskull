import { router } from 'expo-router';
import { View } from 'react-native';
import { PhotoHeader } from '../../src/components/PhotoHeader';
import { useTheme } from '../../src/design/theme';
import { Button } from '../../src/ui/Button';
import { Icon } from '../../src/ui/Icon';
import { BottomBar, ScreenScroll, useGutter } from '../../src/ui/layout';
import { Text } from '../../src/ui/Text';

const POINTS = [
  { icon: 'lift', text: 'Pick a proven program: Greyskull LP, StrongLifts, Starting Strength and more.' },
  { icon: 'check', text: 'Your weights always match the plates you actually have.' },
  { icon: 'progress', text: 'The app adds weight for you and tells you when to back off.' },
] as const;

export default function Welcome() {
  const t = useTheme();
  const gutter = useGutter();
  return (
    <View style={{ flex: 1, backgroundColor: t.color.background }}>
      <ScreenScroll withBottomBar edgeToEdge gap={8}>
        <View style={{ marginHorizontal: -gutter }}>
          <PhotoHeader image="woman-with-barbell" fraction={0.42}>
            <View style={{ flex: 1 }} />
            <Text variant="display" color="onPhoto" accessibilityRole="header">
              Greyskull LP
            </Text>
            <Text variant="body" color="onPhotoMuted">
              Get strong, one session at a time.
            </Text>
          </PhotoHeader>
        </View>
        <View style={{ height: t.space[6] }} />
        <View style={{ gap: t.space[6] }}>
          {POINTS.map((p) => (
            <View key={p.text} style={{ flexDirection: 'row', gap: t.space[4], alignItems: 'flex-start' }}>
              <Icon name={p.icon} size={24} color="accent" />
              <Text style={{ flex: 1 }}>{p.text}</Text>
            </View>
          ))}
        </View>
      </ScreenScroll>
      <BottomBar>
        <Button
          title="Get started"
          size="lg"
          testID="get-started"
          onPress={() => router.push('/setup/gym')}
        />
      </BottomBar>
    </View>
  );
}
