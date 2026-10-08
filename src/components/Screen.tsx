import type { ReactNode } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { space } from '../theme';
import { Background } from './Background';

/** Scrolling page on the shared background; the standard container for non-session screens. */
export function Screen({ children, image }: { children: ReactNode; image?: string }) {
  return (
    <Background image={image}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </Background>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.gutter, gap: space.gap, paddingBottom: 48 },
});
