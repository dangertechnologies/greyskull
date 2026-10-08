import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { ImageBackground, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BACKGROUNDS } from '../backgrounds';
import { useTheme } from '../design/theme';

/**
 * Photo with a scrim at the top of a screen. Text placed in it is always light (`onPhoto`), in both schemes,
 * and so is the status bar while the header is mounted.
 */
export function PhotoHeader({
  image = 'default',
  fraction = 0.34,
  children,
}: {
  image?: string;
  fraction?: number;
  children: ReactNode;
}) {
  const t = useTheme();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return (
    <ImageBackground
      source={BACKGROUNDS[image] ?? BACKGROUNDS.default}
      resizeMode="cover"
      style={{ height: Math.max(240, height * fraction), backgroundColor: t.color.surface }}
    >
      <StatusBar style="light" />
      <View
        style={{
          flex: 1,
          backgroundColor: t.color.scrim,
          paddingTop: insets.top + t.space[2],
          padding: t.space[5],
        }}
      >
        {children}
      </View>
    </ImageBackground>
  );
}
