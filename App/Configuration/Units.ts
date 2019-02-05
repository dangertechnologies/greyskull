export const displayKg = (weight: number, unit: 'kg' | 'lbs') =>
  unit === 'kg' ? weight : weight * 2.2;

export const metricToImperial = (weight: number) => weight * 2.2;
export const imperialToMetric = (weight: number) => weight / 2.2;

// Imperial weight plates are in 2.5 increments
// Metric weight plates are in 1.25 increments.
// We assume symmetry on the barbell and around to 2*1.25 for metric and 2*2.5 for imperial
export const roundToAvailableWeightPlates = (weight: number, unit: 'METRIC' | 'IMPERIAL') =>
  unit === 'METRIC' ? Math.round(weight / 2.5) * 2.5 : Math.round(weight / 5) * 5;

// Calculate the 1RM based on total reps and weight
export const epleyOneRepMax = (weight: number, reps: number) => weight * (1 + reps / 30);

// Calculate the 5RM (87% of 1RM)
export const fiveRepMax = (weight: number, reps: number) => 0.87 * epleyOneRepMax(weight, reps);
