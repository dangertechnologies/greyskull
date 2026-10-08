import { Image } from 'react-native';
import { ICONS } from '../icons';

export function ExerciseIcon({ icon, size = 28 }: { icon: string; size?: number }) {
  return (
    <Image
      accessibilityElementsHidden
      importantForAccessibility="no"
      source={ICONS[icon] ?? ICONS.muscle}
      style={{ width: size, height: size, tintColor: '#fff' }}
    />
  );
}
