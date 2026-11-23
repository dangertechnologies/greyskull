import { EXERCISE_ICONS, type Pictogram } from './exerciseIcons';

/**
 * The shared pictogram set for the exercise library: one drawing per movement, in the same style as
 * `EXERCISE_ICONS` (32 × 32 grid, stroke 2, filled heads r 2.5, outlined plates or kettlebells). Side views face
 * right. Library entries point at one of these keys; the lifts that already had a drawing reuse it.
 */
export const PICTOGRAM_KEYS = [
  'squat',
  'front-squat',
  'goblet-squat',
  'lunge',
  'split-squat',
  'pistol',
  'shrimp-squat',
  'step-up',
  'deadlift',
  'rdl',
  'hip-thrust',
  'nordic',
  'kb-swing',
  'bench',
  'incline-press',
  'overhead-press',
  'push-up',
  'pike-push-up',
  'handstand-push-up',
  'dip',
  'row',
  'inverted-row',
  'pull-up',
  'chin-up',
  'muscle-up',
  'lat-pulldown',
  'curl',
  'triceps-extension',
  'lateral-raise',
  'face-pull',
  'shrug',
  'calf-raise',
  'leg-extension',
  'leg-curl',
  'plank',
  'hollow-hold',
  'l-sit',
  'leg-raise',
  'ab-wheel',
  'bridge',
  'back-extension',
  'handstand',
  'front-lever',
  'back-lever',
  'planche',
  'support-hold',
  'dead-hang',
  'carry',
  'stretch',
  'cardio',
  'generic',
] as const;

export type PictogramKey = (typeof PICTOGRAM_KEYS)[number];

export const PICTOGRAMS: Record<PictogramKey, Pictogram> = {
  squat: EXERCISE_ICONS.BARBELL_SQUAT,
  // Bottom of a front squat: upright torso, bar resting on the front of the shoulders, elbows up.
  'front-squat': {
    d: 'M15.5 28 H22.5 M17.5 28 L21 20.5 L12 19.5 L15.5 9 M15.5 11.5 L23 15',
    dots: [[15.5, 5, 2.5]],
    rings: [[21, 11, 2.5]],
  },
  // Bottom of a squat holding a kettlebell at the chest.
  'goblet-squat': {
    d: 'M15.5 28 H22.5 M17.5 28 L21 20.5 L12 19.5 L15.5 9 M15.5 10.5 L17.5 16.5 L20.5 12.5 M19.2 13.8 Q21 9.6 22.8 13.8',
    dots: [[15.5, 5, 2.5]],
    rings: [[21, 15.6, 2.4]],
  },
  // Forward lunge: front shin vertical, back knee just above the floor.
  lunge: {
    d: 'M15 8.5 V19 L23 19.5 V28 M15 19 L10.5 26.5 L4 27.5 M15 10.5 L17 17.5 M21.5 28 H26',
    dots: [[15, 5, 2.5]],
  },
  // Split squat with the back foot up on a bench.
  'split-squat': {
    d: 'M17 8.5 V19 L25 19.5 V28 M17 19 L12 25.5 L6 20.5 M17 10.5 L19 17.5 M23.5 28 H27.5 M1.5 21.5 H9 M3 21.5 V28 M7.5 21.5 V28',
    dots: [[17, 5, 2.5]],
  },
  // Bottom of a pistol squat: one leg folded, the other straight out in front, arms forward.
  pistol: {
    d: 'M13 28 H19 M15.5 28 L20 20.5 L12 22.5 L17 12.5 M12 22.5 L28.5 20 M17 13.5 L27.5 13',
    dots: [[18.6, 9.2, 2.5]],
  },
  // Shrimp squat: one leg bent behind with the knee near the floor, arms forward.
  'shrimp-squat': {
    d: 'M17 28 H23 M19.5 28 L23.5 20.5 L15 21 L19.5 11 M15 21 L11.5 27 L5.5 23.5 M19.5 12 L28 12.5',
    dots: [[21, 7.6, 2.5]],
  },
  // Stepping up onto a box, front foot on top.
  'step-up': {
    d: 'M14 18 L11 28.5 M14 18 L20 15.5 L21 22 M14 18 L14.5 7.5 M14.5 9 L17.5 15 M18 22 H28 V28.5 M18 22 V28.5',
    dots: [[15, 4, 2.5]],
  },
  deadlift: EXERCISE_ICONS.DEADLIFT,
  // Romanian deadlift: legs almost straight, hips pushed back, bar at the knees.
  rdl: {
    d: 'M7 12.5 L18 14.5 L18.5 19.5 M7 12.5 L12 20.5 L11.5 28 M9 28 H15',
    dots: [[21.6, 15.3, 2.5]],
    rings: [[18.5, 22.5, 3]],
  },
  // Hip thrust: upper back on a bench, hips up under the bar, knees bent.
  'hip-thrust': {
    d: 'M8.5 18 L18 14.5 L25 16 V27 M22.5 27 H29 M8.5 18 L15 12.5 M1.5 20.5 H10 M4 20.5 V27',
    dots: [[5, 15, 2.5]],
    rings: [[18, 11, 3]],
  },
  // Nordic curl: kneeling with the ankles held down, body leaning forward in one line.
  nordic: {
    d: 'M2 27 H9 L14.5 20 L21 12 M21 12.5 L26 17.5',
    dots: [[23.2, 9.1, 2.5]],
    rings: [[4, 24.5, 1.5]],
  },
  // Top of a kettlebell swing: standing tall, straight arms holding the bell out at chest height.
  'kb-swing': {
    d: 'M13 8.5 V19.5 L11 29 M13 19.5 L15 29 M13.5 10.5 L23 12 M22 13 Q23.5 9 25 13',
    dots: [[13.5, 5, 2.5]],
    rings: [[23.5, 15.5, 2.5]],
  },
  bench: EXERCISE_ICONS.BENCH_PRESS,
  // Incline press: lying back on an inclined bench, arms locked out over the shoulders.
  'incline-press': {
    d: 'M17 21.5 L10.5 12.5 M17 21.5 L24.5 20 L25 28 M10.5 13 L13.8 7 M8 15.5 L14.5 23.5 H20 M14.5 23.5 V28 M20 23.5 V28',
    dots: [[7.7, 9.6, 2.5]],
    rings: [[14.5, 4, 3]],
  },
  'overhead-press': EXERCISE_ICONS.MILITARY_PRESS,
  // Top of a push-up: straight body, straight arms.
  'push-up': {
    d: 'M3 27 L12.5 22.5 L22.5 17.5 V27',
    dots: [[25.8, 15.8, 2.5]],
  },
  // Pike push-up: hips high, head down between the arms.
  'pike-push-up': {
    d: 'M5 28 L13 13 L20 21 L21.5 28',
    dots: [[22.6, 23.4, 2.5]],
  },
  // Bottom of a handstand push-up against the wall, head near the floor.
  'handstand-push-up': {
    d: 'M21 20 L22 10 L27 2.5 M21 20 L15.5 22.5 L18 28.5 M10 28.5 H29.5 V1.5',
    dots: [[21, 23.8, 2.5]],
  },
  dip: EXERCISE_ICONS.DIPS,
  row: EXERCISE_ICONS.BENT_OVER_ROW,
  // Inverted row on rings: heels on the floor, straight body, chest pulled up to the hands.
  'inverted-row': {
    d: 'M3 27.5 L12 23.5 L20.5 19.5 L19.3 10.5 M19 1 V6',
    dots: [[24.5, 17.6, 2.5]],
    rings: [[19, 8.3, 2]],
  },
  // Top of a wide-grip pull-up, front view: head over the bar, elbows out.
  'pull-up': {
    d: 'M2 11 H30 M6.5 11 L8.5 18 L13 15 H19 L23.5 18 L25.5 11 M16 15 V23 L14 29 M16 23 L18 29',
    dots: [[16, 8, 2.5]],
  },
  // Top of a close-grip chin-up, front view: head over the bar, elbows tucked.
  'chin-up': {
    d: 'M2 11 H30 M13.5 11 L11.5 18 L13 15 H19 L20.5 18 L18.5 11 M16 15 V23 L14 29 M16 23 L18 29',
    dots: [[16, 8, 2.5]],
  },
  // Muscle-up, front view: body pressed up above a straight bar, with the up-and-over path beside it.
  'muscle-up': {
    d: 'M6 17 H30 M12 17 L13 9 H19 L20 17 M16 9 V17 L14 28 M16 17 L18 28 M4 27 Q1.5 18 5 10 M3 11.5 L5 10 L6.5 12',
    dots: [[16, 5.5, 2.5]],
  },
  // Lat pulldown, front view: seated, wide bar pulled down to the chest on a cable from overhead.
  'lat-pulldown': {
    d: 'M4 13 H28 M7.5 13 L16 1.5 L24.5 13 M8 13 L10 19 L13 15.5 H19 L22 19 L24 13 M16 15.5 V23 M10 23 H22 M13 23 L12 29 M19 23 L20 29',
    dots: [[16, 9.3, 2.5]],
  },
  curl: EXERCISE_ICONS.CURLS,
  // Overhead triceps extension: elbows up by the head, weight lowered behind it.
  'triceps-extension': {
    d: 'M14 11 V21.5 L12 29.5 M14 21.5 L16 29.5 M14.5 12 L16.5 3.5 L10.5 8.5',
    dots: [[14.5, 7.5, 2.5]],
    rings: [[8.5, 10, 2]],
  },
  // Lateral raise, front view: arms out to the sides with a dumbbell in each hand.
  'lateral-raise': {
    d: 'M16 9.5 V19.5 L13.5 28.5 M16 19.5 L18.5 28.5 M16 10.5 L7 11.5 M16 10.5 L25 11.5',
    dots: [[16, 6, 2.5]],
    rings: [
      [4.5, 11.5, 2.5],
      [27.5, 11.5, 2.5],
    ],
  },
  // Face pull: standing, elbows high, rope pulled from a high cable towards the face.
  'face-pull': {
    d: 'M14 9.5 L13 19.5 L10.5 29 M13 19.5 L16 29 M14 10.5 L10.5 9 L18.5 7 H30',
    dots: [[14.5, 5.8, 2.5]],
  },
  // Shrug, front view: shoulders pulled up to the ears, bar hanging from straight arms.
  shrug: {
    d: 'M11 8 L16 10.5 L21 8 M16 10.5 V20 L14 29 M16 20 L18 29 M11 8 V18.5 M21 8 V18.5 M3 18.5 H29 M5.5 15 V22 M26.5 15 V22',
    dots: [[16, 6, 2.5]],
  },
  // Calf raise: up on the toes at the edge of a step, heels lifted.
  'calf-raise': {
    d: 'M15 8.5 V18.5 L14.5 25 L18.5 27 M15 10 L16 18 M16.5 27.5 H28 M9 23 V15 M7 17 L9 15 L11 17',
    dots: [[15, 5, 2.5]],
  },
  // Leg extension: seated in the machine, legs straightened out against the ankle pad.
  'leg-extension': {
    d: 'M9 20.5 V10 M9 20.5 H17 L25.5 19.5 M9 11.5 L11.5 18.5 M6 9.5 V22.5 H18 M12 22.5 V28.5',
    dots: [[9.5, 6.3, 2.5]],
    rings: [[25.5, 22, 1.5]],
  },
  // Leg curl: lying face down on the machine, heels curled up against the pad.
  'leg-curl': {
    d: 'M7.5 17.5 H18 L25.5 17.5 L23 10.5 M7.5 18 L6 20 M3 20 H28 M6 20 V28 M24 20 V28',
    dots: [[4.5, 16, 2.5]],
    rings: [[25, 8.5, 1.5]],
  },
  // Forearm plank: straight body on the toes and forearms.
  plank: {
    d: 'M3 27 L12.5 24 L22 21 V27 H29',
    dots: [[25.5, 19.8, 2.5]],
  },
  // Hollow hold: lying on the back, lower back pressed down, arms and legs held off the floor.
  'hollow-hold': {
    d: 'M2 27.5 H30 M16 25.5 L7.5 21.5 L4 13.5 M16 25.5 L29 20',
    dots: [[4, 22, 2.5]],
  },
  // L-sit on parallettes: arms straight, legs held straight out in front.
  'l-sit': {
    d: 'M11 10.5 V21.5 H28 M11.5 12 L12.5 22.5 M9 23 H16 M10 23 V28 M15 23 V28',
    dots: [[11.5, 7, 2.5]],
  },
  // Hanging leg raise: hanging from the bar with the legs raised to horizontal.
  'leg-raise': {
    d: 'M8 2.5 H20 M14 2.5 V12.5 V23 H29',
    dots: [[17, 9.5, 2.5]],
  },
  // Ab-wheel rollout: kneeling, body stretched out, arms forward on the wheel.
  'ab-wheel': {
    d: 'M2 27.5 H8 L13.5 20 L21 17 L25 23.5',
    dots: [[24.3, 15.5, 2.5]],
    rings: [[25.5, 26, 2.5]],
  },
  // Full back bridge: hands and feet on the floor, hips pushed up into an arch.
  bridge: {
    d: 'M4 28 H9 L9 20 Q15 6 22 16.5 L24.5 28 H28',
    dots: [[20, 20, 2.5]],
  },
  // Back extension on a hyperextension bench: hips on the pad, heels hooked, body held straight.
  'back-extension': {
    d: 'M3 13 L13 15 H23 M2 11 H6 M10 17 H17 M13.5 17 V28 M3 28 H25',
    dots: [[26.7, 14.7, 2.5]],
  },
  // Free handstand: straight arms, body stacked over the hands.
  handstand: {
    d: 'M15.5 28 V19.5 V9 L16 1.5 M10 28.5 H22',
    dots: [[18.3, 22.5, 2.5]],
  },
  // Front lever: hanging from the bar, body held horizontal and face up.
  'front-lever': {
    d: 'M11 16 H30 M11 16 L13.5 6.5',
    dots: [[7.3, 16, 2.5]],
    rings: [[13.5, 5, 1.5]],
  },
  // Back lever: face down, arms reaching back to the bar behind the body.
  'back-lever': {
    d: 'M8.5 18 H29 M8.5 18 L16 13',
    dots: [[4.8, 18, 2.5]],
    rings: [[17, 12, 1.5]],
  },
  // Planche: body held horizontal over straight arms, feet off the floor.
  planche: {
    d: 'M2.5 17.5 H19 L16.5 27 M11 28 H22',
    dots: [[22.7, 17, 2.5]],
  },
  // Support hold on rings, front view: arms locked straight at the sides.
  'support-hold': {
    d: 'M10 1 V17.5 M22 1 V17.5 M13 10 H19 M13 10 L10 17.5 M19 10 L22 17.5 M16 10 V21 L14 29 M16 21 L18 29',
    dots: [[16, 6.5, 2.5]],
    rings: [
      [10, 19.5, 2],
      [22, 19.5, 2],
    ],
  },
  // Dead hang, front view: straight arms from the bar, body relaxed.
  'dead-hang': {
    d: 'M3 3 H29 M12.5 3 L13 14 H19 L19.5 3 M16 14 V22 L14 29 M16 22 L18 29',
    dots: [[16, 9.5, 2.5]],
  },
  // Farmer's carry, front view: a kettlebell hanging from each hand.
  carry: {
    d: 'M16 9.5 V19.5 L13.5 28.5 M16 19.5 L18.5 28.5 M13 10.5 H19 M13 10.5 L10 18 M19 10.5 L22 18 M8.3 19.8 Q10 16 11.7 19.8 M20.3 19.8 Q22 16 23.7 19.8',
    dots: [[16, 6, 2.5]],
    rings: [
      [10, 21.5, 2.3],
      [22, 21.5, 2.3],
    ],
  },
  // Standing quad stretch: one heel pulled up behind, free arm out for balance.
  stretch: {
    d: 'M15 8.5 V18.5 L15.5 29 M15 18.5 L13 24.5 L8.5 19 M15 10 L9 18.5 M15 10 L22 12.5',
    dots: [[15.5, 5, 2.5]],
  },
  // Running: mid-stride, leaning forward, arms swinging.
  cardio: {
    d: 'M17.5 8.5 L14.5 18.5 L20 22 L17.5 28.5 M14.5 18.5 L11 24 L5 23 M17 10 L20.5 14 L24 11 M17 10 L12.5 12.5 L10.5 16.5',
    dots: [[19, 5, 2.5]],
  },
  // Standing figure, arms relaxed: an exercise without its own drawing.
  generic: {
    d: 'M16 9 V19.5 L13 29 M16 19.5 L19 29 M16 10.5 L11.5 18.5 M16 10.5 L20.5 18.5',
    dots: [[16, 5.5, 2.5]],
  },
};
