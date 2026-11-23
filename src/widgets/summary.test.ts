import { active } from '../__fixtures__/oneProgram';
import { TEMPLATES } from '../domain';
import { initialState } from '../store';
import { ALL_PAUSED_NEXT, CONFIRM_NEXT, EMPTY_NEXT, nextWorkoutProps } from './summary';

describe('widget text for states without a workout to show', () => {
  test('no program asks to set one up', () => {
    expect(nextWorkoutProps(initialState())).toEqual(EMPTY_NEXT);
  });

  test('every program paused says so and asks to resume one, not to set up', () => {
    const s = { ...initialState(), programs: [{ ...active(TEMPLATES.base), paused: true }] };
    const p = nextWorkoutProps(s);
    expect(p).toEqual(ALL_PAUSED_NEXT);
    expect(`${p.title} ${p.subtitle}`).toMatch(/paused/i);
    expect(p.subtitle).toMatch(/resume/i);
    expect(p.ready).toBe(false);
  });

  test('weights from the old version are not shown until they are confirmed', () => {
    const s = { ...initialState(), programs: [active(TEMPLATES.base)], needsWeightConfirm: true };
    const p = nextWorkoutProps(s);
    expect(p).toEqual(CONFIRM_NEXT);
    expect(p.lines).toEqual([]);
  });
});
