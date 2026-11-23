import type { ActiveProgram } from '../domain';
import { useStore } from '../store';

/**
 * The program with this id, or undefined for a missing, empty or unknown id: a route parameter that is
 * absent never resolves to some other program.
 */
export const useProgramById = (id: string | undefined): ActiveProgram | undefined =>
  useStore((s) => (id ? s.programs.find((p) => p.id === id) : undefined));
