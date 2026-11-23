import { useMemo } from 'react';
import type { Exercise, PlateInventory, Unit } from '../domain';
import { formatWeight, inventoryFor, loadable, roundForExercise, toKg, toUnit } from '../domain';
import { useInventory, useUnit } from '../store';
import { NumberStepper } from '../ui/NumberStepper';

interface Props {
  kg: number;
  onChange(kg: number): void;
  exercise?: Exercise;
  label?: string;
  large?: boolean;
  inline?: boolean;
  /** Override the store's unit/inventory (used by Setup, which edits a draft). */
  unit?: Unit;
  inventory?: PlateInventory;
}

/**
 * Steps through the weights the user can actually load: bar totals (on the exercise's own bar), owned kettlebells,
 * added load in single plates for bodyweight, or the exercise's rounding step.
 */
export function WeightStepper({
  kg,
  onChange,
  exercise,
  label,
  large,
  inline,
  unit: unitProp,
  inventory: inventoryProp,
}: Props) {
  const storeUnit = useUnit();
  const storeInventory = useInventory();
  const unit = unitProp ?? storeUnit;
  const inventory = inventoryProp ?? storeInventory;
  const barbell = !exercise || exercise.kind === 'barbell';
  const values = useMemo(() => {
    if (barbell) return loadable(exercise ? inventoryFor(exercise, inventory) : inventory, unit).totals;
    const bells =
      exercise?.kind === 'kettlebell' ? inventory[unit === 'kg' ? 'kettlebellsKg' : 'kettlebellsLb'] : [];
    return bells.length > 0 ? [...bells].sort((a, b) => a - b) : undefined;
  }, [barbell, exercise, inventory, unit]);
  // Bodyweight: added load in single plates, from none at all.
  const bodyweight = exercise?.kind === 'bodyweight';
  const smallestPlate = Math.min(...(unit === 'kg' ? inventory.platesKg : inventory.platesLb).filter((p) => p > 0));
  const step = barbell
    ? undefined
    : bodyweight && Number.isFinite(smallestPlate)
      ? smallestPlate
      : (exercise?.step ?? { kg: 2, lb: 5 })[unit];
  const display = toUnit(kg, unit);
  const snap = (v: number) => {
    const out = toKg(v, unit);
    return exercise && !barbell ? roundForExercise(out, exercise, 'nearest', inventory, unit) : out;
  };
  return (
    <NumberStepper
      label={label}
      size={large ? 'lg' : 'md'}
      inline={inline}
      value={display}
      values={values}
      step={step}
      min={bodyweight ? 0 : step}
      format={(v) =>
        bodyweight
          ? v > 0
            ? `+${formatWeight(toKg(v, unit), unit)}`
            : 'Bodyweight'
          : formatWeight(toKg(v, unit), unit)
      }
      onChange={(v) => onChange(snap(v))}
    />
  );
}
