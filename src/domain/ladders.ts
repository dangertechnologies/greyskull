import data from '../catalog/ladders.json';
import type { Ladder } from './types';

/** Built-in progression ladders (calisthenics steps from easiest to hardest). */
export const LADDERS = data as Ladder[];

const byId = new Map(LADDERS.map((l) => [l.id, l]));

export const getLadder = (id: string): Ladder | undefined => byId.get(id);
