import type { Kind } from '../domain/types';

/**
 * Line pictograms on a 32 × 32 grid, drawn as one stroked path plus circles (heads filled, end-on plates
 * outlined). Built-in exercises get a figure doing the lift; custom exercises get the drawing for their kind.
 * Pure data, so a script can render them to check the drawings outside the app.
 */
export interface Pictogram {
  /** Stroked lines (SVG path data). */
  d: string;
  /** Filled circles [cx, cy, r]: heads. */
  dots?: [number, number, number][];
  /** Outlined circles [cx, cy, r]: barbell plates seen end-on. */
  rings?: [number, number, number][];
}

export const EXERCISE_ICONS: Record<string, Pictogram> = {
  // Bottom of a back squat, side view, bar on the upper back.
  BARBELL_SQUAT: {
    d: 'M18.5 9 L11 19 L20.5 21 L17.5 28 M15.5 28 H22.5',
    dots: [[22, 5.5, 2.5]],
    rings: [[15.5, 9.5, 3.5]],
  },
  // Deadlift start: hips high, straight arms down to the bar on the floor.
  DEADLIFT: {
    d: 'M9 15 L19 10 M19 10 L20 20.5 M9 15 L14 21 L12 28 M10 28 H16',
    dots: [[22.5, 8.5, 2.5]],
    rings: [[20, 24, 3.5]],
  },
  // Lying on the bench, arms locked out with the bar over the chest.
  BENCH_PRESS: {
    d: 'M9 19 H21 L25 24 L25 28 M12 19 V11.5 M4 22 H23 M7 22 V27 M20 22 V27',
    dots: [[6, 18.5, 2.5]],
    rings: [[12, 8, 3.5]],
  },
  // Front view, bar locked out overhead.
  MILITARY_PRESS: {
    d: 'M4 5 H28 M7 2.5 V7.5 M25 2.5 V7.5 M11 5 L13 14 H19 L21 5 M16 14 V22 L13 29 M16 22 L19 29',
    dots: [[16, 10.5, 2.5]],
  },
  // Front view, chin over the bar.
  CHINUPS: {
    d: 'M3 4 H29 M11 4 L13 14 H19 L21 4 M16 14 V22 L14 29 M16 22 L18 29',
    dots: [[16, 9.5, 2.5]],
  },
  // Side view, forearms raised, bar at the chest.
  CURLS: {
    d: 'M15 8.5 V19 L13 29 M15 19 L17 29 M15.5 10.5 L17 17 L22 12.5',
    dots: [[15, 5, 2.5]],
    rings: [[23.5, 11, 3]],
  },
  // Crunch on the floor, knees bent, shoulders lifted.
  CRUNCHES: {
    d: 'M3 27 H29 M14 25 L20 18 L25 26 M14 25 L8.5 18.5',
    dots: [[6.5, 15.5, 2.5]],
  },
  // Bent-over row, side view, bar hanging from straight arms.
  BENT_OVER_ROW: {
    d: 'M9 14 L21 12 L20.5 18 M9 14 L12.5 21 L10.5 28 M8.5 28 H14',
    dots: [[24, 10, 2.5]],
    rings: [[20.5, 21.5, 3]],
  },
  // Front view on parallel bars.
  DIPS: {
    d: 'M13 10 H19 M13 10 L10 15 M19 10 L22 15 M8 15 H12 M20 15 H24 M9 15 V29 M23 15 V29 M16 10 V19 L14 25 M16 19 L18 25',
    dots: [[16, 6.5, 2.5]],
  },
};

export const KIND_ICONS: Record<Kind, Pictogram> = {
  // Barbell, front view.
  barbell: { d: 'M3 16 H29 M7 9 V23 M10.5 11 V21 M21.5 11 V21 M25 9 V23' },
  // Dumbbell on the diagonal.
  dumbbell: { d: 'M11 21 L21 11 M7 19 L13 25 M9.5 16.5 L15.5 22.5 M16.5 9.5 L22.5 15.5 M19 7 L25 13' },
  // Weight stack with its cable.
  machine: { d: 'M16 3 V9 M10 9 H22 V29 H10 Z M10 14 H22 M10 19 H22 M10 24 H22' },
  // Standing figure, arms out.
  bodyweight: { d: 'M16 9 V20 L13 29 M16 20 L19 29 M9 13 H23', dots: [[16, 5.5, 2.5]] },
};
