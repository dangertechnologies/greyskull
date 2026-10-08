export interface ChartPoint {
  x: number;
  y: number;
}

export interface ChartScale {
  points: ChartPoint[];
  min: number;
  max: number;
}

/**
 * Evenly spaced x, y scaled into the plot box (top = max). A flat series sits in the vertical middle;
 * a single point sits in the horizontal middle.
 */
export function scaleSeries(values: number[], width: number, height: number, pad: number): ChartScale {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const innerW = Math.max(0, width - 2 * pad);
  const innerH = Math.max(0, height - 2 * pad);
  const range = max - min;
  const points = values.map((v, i) => ({
    x: pad + (values.length === 1 ? innerW / 2 : (innerW * i) / (values.length - 1)),
    y: pad + (range === 0 ? innerH / 2 : innerH * (1 - (v - min) / range)),
  }));
  return { points, min, max };
}
