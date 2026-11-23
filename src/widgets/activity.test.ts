/**
 * The rest countdown and an EMOM / interval timer share one Live Activity. Each side ends only its own, so the
 * session screen ending a finished rest never ends a running timer's activity, and the other way round.
 */
const mockCalls: string[] = [];
const mockActivity = (id: number) => ({
  update: jest.fn(
    async (_p: unknown, stale?: Date) => void mockCalls.push(`update ${id} ${stale?.getTime()}`),
  ),
  end: jest.fn(async () => void mockCalls.push(`end ${id}`)),
});
let mockNext = 0;
jest.mock('expo', () => ({ ...jest.requireActual('expo'), requireOptionalNativeModule: () => ({}) }));
jest.mock('./definitions', () => ({
  restActivity: {
    start: (props: { kicker?: string }, _url: unknown, stale: Date) => {
      mockNext += 1;
      mockCalls.push(`start ${mockNext} ${props.kicker ?? 'REST'} ${stale.getTime()}`);
      return mockActivity(mockNext);
    },
  },
}));

import { endRestActivity, endTimerActivity, showTimerActivity, startRestActivity } from './index';

const timer = { kicker: 'MINUTE 1 OF 10', title: 'Swing', label: '', startsAt: 0, endsAt: 60_000 };

beforeEach(() => {
  mockCalls.length = 0;
  endRestActivity();
  endTimerActivity();
  mockCalls.length = 0;
});

test('a timer replaces a rest countdown; ending the rest afterwards leaves the timer alone', () => {
  startRestActivity('Next: Swing', 90);
  showTimerActivity(timer, 60_000);
  endRestActivity();
  showTimerActivity({ ...timer, kicker: 'MINUTE 2 OF 10' }, 120_000);
  endTimerActivity();
  expect(mockCalls.map((c) => c.replace(/ \d{10,}$/, ''))).toEqual([
    `start ${mockNext - 1} REST`,
    `end ${mockNext - 1}`,
    `start ${mockNext} MINUTE 1 OF 10 60000`,
    `update ${mockNext} 120000`,
    `end ${mockNext}`,
  ]);
});

test('ending a timer leaves a rest countdown alone', () => {
  startRestActivity('Next: Swing', 90);
  endTimerActivity();
  expect(mockCalls.some((c) => c.startsWith('end'))).toBe(false);
  endRestActivity();
  expect(mockCalls.at(-1)).toBe(`end ${mockNext}`);
});
