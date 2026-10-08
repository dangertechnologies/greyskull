import * as WebBrowser from 'expo-web-browser';
import { Pressable, View } from 'react-native';
import { useTheme } from '../design/theme';
import type { Exercise } from '../domain';
import { Icon } from '../ui/Icon';
import type { IconName } from '../ui/icons';
import { Text } from '../ui/Text';

/** "Watch technique" / "Read guide" links for an exercise; renders nothing when it has neither. */
export function TechniqueLinks({ exercise, compact = false }: { exercise: Exercise; compact?: boolean }) {
  const t = useTheme();
  const links = [
    exercise.video
      ? { key: 'video', label: 'Watch technique', icon: 'video' as IconName, href: exercise.video }
      : null,
    !compact && exercise.url
      ? { key: 'url', label: 'Read guide', icon: 'guide' as IconName, href: exercise.url }
      : null,
  ].filter((l) => l !== null);
  if (links.length === 0) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space[3] }}>
      {links.map((l) => (
        <Pressable
          key={l.key}
          accessibilityRole="link"
          accessibilityLabel={`${l.label}: ${exercise.name}`}
          hitSlop={8}
          onPress={() => void WebBrowser.openBrowserAsync(l.href)}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: t.space[2],
            minHeight: 48,
            paddingHorizontal: t.space[4],
            borderRadius: t.radius.pill,
            borderWidth: 1,
            borderColor: t.color.borderStrong,
            backgroundColor: pressed ? t.color.surfaceRaised : 'transparent',
          })}
        >
          <Icon name={l.icon} size={20} color="accent" />
          <Text variant="bodyStrong">{l.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}
