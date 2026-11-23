import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import * as Sharing from 'expo-sharing';
import { BEFORE_RESTORE_PREFIX, stateFile, UNREADABLE_PREFIX } from '../storage';
import { initialState, useStore } from '../store';
import { routes } from '../testRoutes';

const files = (jest.requireMock('expo-file-system') as { __files: Map<string, string> }).__files;

beforeEach(() => {
  useStore.setState({ ...initialState(), hydrated: true });
});

test('settings offers each kept copy of the data for export, and nothing when there is none', async () => {
  await renderRouter(routes(), { initialUrl: '/settings' });
  await screen.findByText('Export backup');
  expect(screen.queryByText(/Copies of your data kept/)).toBeNull();
});

test('a copy kept before a restore and one kept from unreadable data are shared as they are', async () => {
  const before = `file:///documents/${BEFORE_RESTORE_PREFIX}1000.json`;
  const unreadable = `file:///documents/${UNREADABLE_PREFIX}2000.state.json`;
  // The app loads the saved data when it opens, so a readable data file has to be there.
  files.set(
    stateFile().uri,
    JSON.stringify({ state: JSON.parse(useStore.getState().exportJson()), version: 4 }),
  );
  files.set(before, '{"kept":1}');
  files.set(unreadable, '{broken');
  await renderRouter(routes(), { initialUrl: '/settings' });
  fireEvent.press(await screen.findByText(`Export ${BEFORE_RESTORE_PREFIX}1000.json`));
  await waitFor(() => expect(Sharing.shareAsync).toHaveBeenCalledWith(before, expect.anything()));
  fireEvent.press(screen.getByText(`Export ${UNREADABLE_PREFIX}2000.state.json`));
  await waitFor(() => expect(Sharing.shareAsync).toHaveBeenCalledWith(unreadable, expect.anything()));
  expect(files.get(before)).toBe('{"kept":1}');
});
