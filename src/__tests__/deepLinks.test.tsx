import { renderRouter, screen } from 'expo-router/testing-library';
import { setProgram } from '../__fixtures__/oneProgram';
import { TEMPLATES } from '../domain';
import { initialState, useStore } from '../store';
import { routes } from '../testRoutes';

const all = () => ({
  ...routes(),
  'ladder/[id]': require('../../app/ladder/[id]'),
  'builder/[id]': require('../../app/builder/[id]'),
});

beforeEach(() => {
  useStore.setState({ ...initialState(), hydrated: true });
  setProgram(TEMPLATES.base);
});

// A link such as gslp:///lift/toString must find nothing, not a member of Object.prototype.
const HOSTILE = ['toString', 'constructor', '__proto__', 'hasOwnProperty', 'valueOf'];

describe.each(HOSTILE)('a deep link with the id %s', (id) => {
  test('/exercises/<id> is not found', async () => {
    await renderRouter(all(), { initialUrl: `/exercises/${id}` });
    expect(await screen.findByText('Exercise not found')).toBeTruthy();
  });

  test('/lift/<id> is not found', async () => {
    await renderRouter(all(), { initialUrl: `/lift/${id}` });
    expect(await screen.findByText('Exercise not found')).toBeTruthy();
  });

  test('/lift/<id>@T2 is not found', async () => {
    await renderRouter(all(), { initialUrl: `/lift/${id}@T2` });
    expect(await screen.findByText('Exercise not found')).toBeTruthy();
  });

  test('/ladder/<id> is not found', async () => {
    await renderRouter(all(), { initialUrl: `/ladder/${id}` });
    expect(await screen.findByText('Ladder not found')).toBeTruthy();
  });

  test('/builder/<id> and a copy of that program are not found', async () => {
    await renderRouter(all(), { initialUrl: `/builder/${id}` });
    expect(await screen.findByText('Program not found')).toBeTruthy();
  });

  test('/program/<id> is not found', async () => {
    await renderRouter(all(), { initialUrl: `/program/${id}` });
    expect(await screen.findByText('Program not found')).toBeTruthy();
  });
});

test('a lift screen for a real exercise but a hostile program id says the program is missing', async () => {
  await renderRouter(all(), { initialUrl: '/lift/BENCH_PRESS?program=toString' });
  expect(await screen.findByText('Program not found')).toBeTruthy();
});
