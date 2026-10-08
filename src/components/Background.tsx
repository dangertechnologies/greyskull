import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { ImageBackground, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BACKGROUNDS } from '../backgrounds';
import { colors } from '../theme';

interface Props {
  /** Key into BACKGROUNDS; defaults to the squat photo. */
  image?: string;
  /** Respect the top safe area (for screens without a navigation header). */
  topInset?: boolean;
  children: ReactNode;
}

/** Full-bleed blurred photo, dark overlay, safe-area content. */
export function Background({ image = 'default', topInset = false, children }: Props) {
  return (
    <ImageBackground source={BACKGROUNDS[image] ?? BACKGROUNDS.default} style={styles.fill} resizeMode="cover">
      <StatusBar style="light" />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]} />
      <SafeAreaView style={styles.fill} edges={topInset ? ['top', 'bottom', 'left', 'right'] : ['bottom', 'left', 'right']}>
        {children}
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1, backgroundColor: colors.bg } });
