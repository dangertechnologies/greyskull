import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Exercise } from '../domain';
import { colors } from '../theme';

/** "Watch technique" / "Read guide" links for an exercise; renders nothing when it has neither. */
export function TechniqueLinks({ exercise, compact = false }: { exercise: Exercise; compact?: boolean }) {
  const links = [
    exercise.video
      ? { key: 'video', label: 'Watch technique', icon: 'play-circle-outline' as const, href: exercise.video }
      : null,
    !compact && exercise.url
      ? { key: 'url', label: 'Read guide', icon: 'book-outline' as const, href: exercise.url }
      : null,
  ].filter((l) => l !== null);
  if (links.length === 0) return null;
  return (
    <View style={styles.row}>
      {links.map((l) => (
        <Pressable
          key={l.key}
          accessibilityRole="link"
          accessibilityLabel={`${l.label}: ${exercise.name}`}
          hitSlop={8}
          onPress={() => void WebBrowser.openBrowserAsync(l.href)}
          style={({ pressed }) => [styles.link, pressed && styles.pressed]}
        >
          <Ionicons name={l.icon} size={20} color={colors.text} />
          <Text style={styles.label}>{l.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.dim,
  },
  pressed: { backgroundColor: colors.faint },
  label: { color: colors.text, fontSize: 15, fontWeight: '400' },
});
