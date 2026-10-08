import { StyleSheet, Text, View } from 'react-native';
import { type } from '../theme';
import { Button } from './Button';
import { Screen } from './Screen';

interface Props {
  lines: string[];
  onHome(): void;
}

export function Celebration({ lines, onHome }: Props) {
  return (
    <Screen image="rest">
      <Text style={[type.title, styles.center]} accessibilityRole="header">
        Workout complete
      </Text>
      <View style={styles.list}>
        {lines.length === 0 ? <Text style={[type.body, styles.center]}>Nice work.</Text> : null}
        {lines.map((line) => (
          <Text key={line} style={[type.body, styles.center]}>
            {line}
          </Text>
        ))}
      </View>
      <Button title="Back to home" onPress={onHome} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
  list: { gap: 10, paddingVertical: 24 },
});
