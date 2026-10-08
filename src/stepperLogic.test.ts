import { stepValue } from './stepperLogic';

test('plain steps with clamping and no float drift', () => {
  expect(stepValue(0.1, 1, { step: 0.2 })).toBe(0.3);
  let v = 0;
  for (let i = 0; i < 10; i++) v = stepValue(v, 1, { step: 0.1 });
  expect(v).toBe(1);
  expect(stepValue(300, 1, { step: 15, max: 300 })).toBe(300);
  expect(stepValue(0, -1, { step: 15, min: 0 })).toBe(0);
});

test('values mode moves to neighbours, including from off-grid values', () => {
  const values = [20, 22.5, 25, 30];
  expect(stepValue(22.5, 1, { values })).toBe(25);
  expect(stepValue(25, -1, { values })).toBe(22.5);
  expect(stepValue(26, 1, { values })).toBe(30);
  expect(stepValue(26, -1, { values })).toBe(25);
  expect(stepValue(30, 1, { values })).toBe(30);
  expect(stepValue(20, -1, { values })).toBe(20);
  expect(stepValue(10, 1, { values })).toBe(20);
  expect(stepValue(10, -1, { values })).toBe(10);
});
