import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../design/theme';
import { Text } from './Text';

/**
 * Bottom sheet for short, focused edits (weight, reps, scheme). A transparent Modal so it behaves the same on iOS
 * and Android, closes on backdrop tap and the system back gesture, and keeps its content in the caller's
 * component state.
 */
export function Sheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose(): void;
  title?: string;
  children: ReactNode;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={[StyleSheet.absoluteFill, { backgroundColor: t.color.backdrop }]}
          onPress={onClose}
        />
        <View
          accessibilityViewIsModal
          style={{
            backgroundColor: t.color.surfaceRaised,
            borderTopLeftRadius: t.radius.xl,
            borderTopRightRadius: t.radius.xl,
            paddingHorizontal: t.space[6],
            paddingTop: t.space[3],
            paddingBottom: Math.max(insets.bottom, t.space[4]) + t.space[4],
            gap: t.space[6],
          }}
        >
          <View
            style={{
              alignSelf: 'center',
              width: 40,
              height: 4,
              borderRadius: 2,
              backgroundColor: t.color.borderStrong,
            }}
          />
          {title ? (
            <Text variant="headline" accessibilityRole="header">
              {title}
            </Text>
          ) : null}
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, justifyContent: 'flex-end' } });
