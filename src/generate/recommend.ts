import { PLANS } from '../config/plans';
import type { Equipment, Exercise, Program } from '../domain';
import { tryParseScheme } from '../domain/program';
import { EQUIPMENT_LABELS } from '../exerciseFilter';
import { type Category, categoryOf, type EquipmentFit, equipmentFit } from '../programPicker';

export const GOALS = ['strength', 'muscle', 'calisthenics', 'general', 'mobility'] as const;
export type Goal = (typeof GOALS)[number];
export const GOAL_LABELS: Record<Goal, string> = {
  strength: 'Strength',
  muscle: 'Muscle',
  calisthenics: 'Calisthenics skills',
  general: 'General fitness',
  mobility: 'Mobility',
};

export const MINUTES = [30, 45, 60, 90] as const;
export type Minutes = (typeof MINUTES)[number];

export const EXPERIENCE = ['new', '6mo', '2y'] as const;
export type Experience = (typeof EXPERIENCE)[number];
export const EXPERIENCE_LABELS: Record<Experience, string> = {
  new: 'New',
  '6mo': '6+ months',
  '2y': '2+ years',
};

export interface Answers {
  goal: Goal;
  /** Training days a week, 1 to 7. */
  days: number;
  minutes: Minutes;
  /** What the user owns; empty means not set (nothing is ruled out), as in the gym settings. */
  equipment: Equipment[];
  experience: Experience;
}

export const DEFAULT_ANSWERS: Answers = {
  goal: 'general',
  days: 3,
  minutes: 45,
  equipment: [],
  experience: 'new',
};

export interface Pick {
  planId: string;
  /** One line on why it suits the answers. */
  reason: string;
}

export interface Recommendation {
  /** Best first; at most three. Empty when no built-in plan fits the goal and the equipment. */
  picks: Pick[];
  /** A second program to run beside the first pick. */
  addOn?: Pick;
}

/** Plan categories for each goal, best match first. */
const GOAL_CATEGORIES: Record<Goal, Category[]> = {
  strength: ['Strength'],
  muscle: ['Hypertrophy'],
  calisthenics: ['Calisthenics'],
  general: ['Calisthenics', 'Hypertrophy', 'Strength'],
  mobility: ['Mobility'],
};

const CATEGORY_TEXT: Record<Category, string> = {
  Strength: 'Strength program',
  Hypertrophy: 'Muscle-building program',
  Calisthenics: 'Bodyweight program',
  Skills: 'Skill program',
  Mobility: 'Mobility program',
};

// ponytail: plan levels as a small id table; move to a `level` field on PlanDefinition if more plans need it.
/** Plans that assume some training behind you. */
const NOT_FOR_NEW = new Set(['gzclp', '531-beginners', 'lyle-gbr', 'six-ladders']);
/** Plain linear plans that an experienced lifter has usually outgrown. */
const FOR_NEW = new Set(['base', 'phrak', 'stronglifts', 'starting-strength']);
/** Meant to run beside another program, so only ever offered as the add-on. */
const ADD_ON = 'skill-track';

/** Rough minutes for the longest day: three minutes a set (two inside a group, where rest is shared) plus warm-up. */
export function sessionMinutes(program: Program): number {
  const perDay = program.days.map(
    (day) =>
      10 +
      day.slots.reduce(
        (sum, slot) => sum + (tryParseScheme(slot.scheme)?.sets ?? 0) * (slot.group ? 2 : 3),
        0,
      ),
  );
  return Math.round(Math.max(0, ...perDay) / 5) * 5;
}

const daysText = (n: number) => `${n} ${n === 1 ? 'day' : 'days'} a week`;

function reasonFor(program: Program, category: Category | null, answers: Answers, fit: EquipmentFit): string {
  const parts = [
    category ? CATEGORY_TEXT[category] : 'Program',
    `${daysText(program.sessionsPerWeek)}${program.sessionsPerWeek === answers.days ? '' : ' (you can change this)'}`,
    `about ${sessionMinutes(program)} min`,
  ];
  if (fit.status === 'fits') parts.push('fits your equipment');
  if (fit.status === 'missing')
    parts.push(`needs ${fit.missing.map((e) => EQUIPMENT_LABELS[e].toLowerCase()).join(', ')}`);
  return parts.join(' · ');
}

/**
 * Built-in plans for the answers, best first: the goal's categories, then the equipment (a plan that fits ranks
 * above one that needs more, and its reason names what is missing), the days and the session length, then
 * experience. Pure.
 */
export function recommend(answers: Answers, exercises: Record<string, Exercise>): Recommendation {
  const categories = GOAL_CATEGORIES[answers.goal];
  const fitOf = (program: Program) => equipmentFit(program, exercises, answers.equipment);
  const scored = PLANS.flatMap((plan, order) => {
    const category = categoryOf(plan.id);
    const rank = category ? categories.indexOf(category) : -1;
    const fit = fitOf(plan.program);
    if (plan.id === ADD_ON || rank < 0) return [];
    let score = 10 - rank * 2;
    if (fit.status === 'fits') score += 2;
    if (fit.status === 'missing') score -= 1.5 * fit.missing.length;
    score -= Math.abs(plan.program.sessionsPerWeek - answers.days) * 0.5;
    if (sessionMinutes(plan.program) > answers.minutes + 15) score -= 1;
    if (answers.experience === 'new' && NOT_FOR_NEW.has(plan.id)) score -= 3;
    if (answers.experience === '2y' && NOT_FOR_NEW.has(plan.id)) score += 1;
    if (answers.experience === '2y' && FOR_NEW.has(plan.id)) score -= 2;
    const pick: Pick = { planId: plan.id, reason: reasonFor(plan.program, category, answers, fit) };
    return [{ pick, score, order }];
  });
  // Stable: equal scores keep the catalogue order.
  scored.sort((a, b) => b.score - a.score || a.order - b.order);
  const picks = scored.slice(0, 3).map((s) => s.pick);

  const skill = PLANS.find((p) => p.id === ADD_ON);
  const wantsSkill =
    answers.goal === 'calisthenics' ||
    ((answers.goal === 'strength' || answers.goal === 'general') &&
      answers.experience !== 'new' &&
      answers.minutes >= 60);
  const addOn =
    skill &&
    picks.length > 0 &&
    wantsSkill &&
    answers.experience !== 'new' &&
    fitOf(skill.program).status !== 'missing'
      ? { planId: skill.id, reason: 'A short handstand, lever and L-sit session to run beside it' }
      : undefined;
  return { picks, ...(addOn ? { addOn } : {}) };
}

/** The answers as one route parameter. */
export const encodeAnswers = (answers: Answers): string => JSON.stringify(answers);

/** Answers from a route parameter; each field that is missing or invalid takes its default. */
export function decodeAnswers(raw: string | undefined): Answers {
  let data: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(raw ?? '');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed))
      data = parsed as Record<string, unknown>;
  } catch {
    // not JSON: every field takes its default
  }
  const one = <T>(list: readonly T[], value: unknown, fallback: T): T =>
    list.includes(value as T) ? (value as T) : fallback;
  const days = Number.isInteger(data.days) && (data.days as number) >= 1 && (data.days as number) <= 7;
  return {
    goal: one(GOALS, data.goal, DEFAULT_ANSWERS.goal),
    days: days ? (data.days as number) : DEFAULT_ANSWERS.days,
    minutes: one(MINUTES, data.minutes, DEFAULT_ANSWERS.minutes),
    equipment: Array.isArray(data.equipment)
      ? [
          ...new Set(
            data.equipment.filter(
              (e): e is Equipment => typeof e === 'string' && Object.hasOwn(EQUIPMENT_LABELS, e),
            ),
          ),
        ]
      : [],
    experience: one(EXPERIENCE, data.experience, DEFAULT_ANSWERS.experience),
  };
}

/** Answers from a route parameter, or, when the screen was opened without one, the defaults with the saved equipment. */
export const answersFrom = (raw: string | undefined, owned: Equipment[]): Answers =>
  raw ? decodeAnswers(raw) : { ...DEFAULT_ANSWERS, equipment: [...owned] };
