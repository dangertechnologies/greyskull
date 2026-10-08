import { useMemo } from 'react';
import type { Exercise, PlateInventory, Unit } from '../domain';
import { formatWeight, loadable, roundForExercise, toKg, toUnit } from '../domain';
import { useInventory, useUnit } from '../store';
import { Stepper } from './Stepper';

interface Props {
  kg: number;
  onChange(kg: number): void;
  exercise?: Exercise;
  label?: string;
  large?: boolean;
  /** Override the store's unit/inventory (used by Setup, which edits a draft). */
  unit?: Unit;
  inventory?: PlateInventory;
}

/** Steps through the weights the user can actually load (barbell) or the exercise's rounding step. */
export function WeightStepper({
  kg,
  onChange,
  exercise,
  label,
  large,
  unit: unitProp,
  inventory: inventoryProp,
}: Props) {
  const storeUnit = useUnit();
  const storeInventory = useInventory();
  const unit = unitProp ?? storeUnit;
  const inventory = inventoryProp ?? storeInventory;
  const barbell = !exercise || exercise.kind === 'barbell';
  const values = useMemo(
    () => (barbell ? loadable(inventory, unit).totals : undefined),
    [barbell, inventory, unit],
  );
  const step = barbell ? undefined : (exercise?.step ?? { kg: 2, lb: 5 })[unit];
  const display = toUnit(kg, unit);
  const snap = (v: number) => {
    const out = toKg(v, unit);
    return exercise && !barbell ? roundForExercise(out, exercise, 'nearest', inventory, unit) : out;
  };
  return (
    <Stepper
      label={label}
      large={large}
      value={display}
      values={values}
      step={step}
      min={step}
      format={(v) => formatWeight(toKg(v, unit), unit)}
      onChange={(v) => onChange(snap(v))}
    />
  );
}
