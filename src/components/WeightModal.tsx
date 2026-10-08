import { Modal, StyleSheet, Text, View } from 'react-native';
import type { Exercise } from '../domain';
import { colors, type } from '../theme';
import { Button } from './Button';
import { PlatesLine } from './PlatesLine';
import { WeightStepper } from './WeightStepper';

interface Props {
  visible: boolean;
  exercise: Exercise;
  kg: number;
  onChange(kg: number): void;
  onClose(): void;
}

/** Change today's weight for one lift: steps through weights the bar can actually carry. */
export function WeightModal({ visible, exercise, kg, onChange, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={type.heading}>{exercise.name}</Text>
          <WeightStepper large exercise={exercise} kg={kg} onChange={onChange} />
          <PlatesLine kg={kg} />
          <Button title="Done" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 },
  sheet: {
    backgroundColor: '#111',
    borderRadius: 8,
    padding: 24,
    gap: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.faint,
  },
});
