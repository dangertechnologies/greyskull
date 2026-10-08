import { scaleSeries } from './chartMath';

test('scales into the box with max at the top', () => {
  const { points, min, max } = scaleSeries([20, 30, 25], 100, 60, 10);
  expect([min, max]).toEqual([20, 30]);
  expect(points).toEqual([
    { x: 10, y: 50 },
    { x: 50, y: 10 },
    { x: 90, y: 30 },
  ]);
});

test('flat and single-value series are centred', () => {
  expect(scaleSeries([5, 5, 5], 100, 60, 10).points.map((p) => p.y)).toEqual([30, 30, 30]);
  expect(scaleSeries([5], 100, 60, 10).points).toEqual([{ x: 50, y: 30 }]);
});
