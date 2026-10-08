import type { Exercise, PlateInventory, Unit } from '../domain';
import { Button } from '../ui/Button';
import { PlateStack } from '../ui/PlateStack';
import { Sheet } from '../ui/Sheet';
import { WeightStepper } from './WeightStepper';

/** Change a lift's weight: steps through weights the bar can actually carry, with the plates shown live. */
export function WeightSheet({
  visible,
  exercise,
  kg,
  onChange,
  onClose,
  unit,
  inventory,
}: {
  visible: boolean;
  exercise: Exercise;
  kg: number;
  onChange(kg: number): void;
  onClose(): void;
  unit?: Unit;
  inventory?: PlateInventory;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title={exercise.name}>
      <WeightStepper
        large
        exercise={exercise}
        kg={kg}
        onChange={onChange}
        unit={unit}
        inventory={inventory}
      />
      {exercise.kind === 'barbell' ? <PlateStack kg={kg} unit={unit} inventory={inventory} /> : null}
      <Button title="Done" onPress={onClose} />
    </Sheet>
  );
}
