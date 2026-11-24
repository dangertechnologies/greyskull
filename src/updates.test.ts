import * as Updates from 'expo-updates';
import { AppState } from 'react-native';
import { CHECK_EVERY_MS, checkForUpdate, startForegroundUpdates } from './updates';

const mocked = Updates as unknown as {
  isEnabled: boolean;
  checkForUpdateAsync: jest.Mock;
  fetchUpdateAsync: jest.Mock;
};

beforeEach(() => {
  mocked.isEnabled = true;
  mocked.checkForUpdateAsync.mockReset().mockResolvedValue({ isAvailable: false });
  mocked.fetchUpdateAsync.mockReset().mockResolvedValue({ isNew: true });
});

describe('checkForUpdate', () => {
  it('does nothing where updates are off', async () => {
    mocked.isEnabled = false;
    expect(await checkForUpdate()).toBe('disabled');
    expect(mocked.checkForUpdateAsync).not.toHaveBeenCalled();
  });

  it('says none when there is nothing new, and downloads nothing', async () => {
    expect(await checkForUpdate()).toBe('none');
    expect(mocked.fetchUpdateAsync).not.toHaveBeenCalled();
  });

  it('downloads an available update and says ready', async () => {
    mocked.checkForUpdateAsync.mockResolvedValue({ isAvailable: true });
    expect(await checkForUpdate()).toBe('ready');
    expect(mocked.fetchUpdateAsync).toHaveBeenCalledTimes(1);
  });

  it('follows a rollback to the built-in version', async () => {
    mocked.checkForUpdateAsync.mockResolvedValue({ isAvailable: false, isRollBackToEmbedded: true });
    mocked.fetchUpdateAsync.mockResolvedValue({ isNew: false, isRollBackToEmbedded: true });
    expect(await checkForUpdate()).toBe('ready');
  });

  it('reports an error instead of throwing, and can run again after it', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    mocked.checkForUpdateAsync.mockRejectedValueOnce(new Error('offline'));
    expect(await checkForUpdate()).toBe('error');
    expect(await checkForUpdate()).toBe('none');
  });

  it('shares one check between callers that arrive together', async () => {
    const [a, b] = await Promise.all([checkForUpdate(), checkForUpdate()]);
    expect([a, b]).toEqual(['none', 'none']);
    expect(mocked.checkForUpdateAsync).toHaveBeenCalledTimes(1);
  });
});

describe('startForegroundUpdates', () => {
  const listen = () => {
    let handler: (s: string) => void = () => undefined;
    const remove = jest.fn();
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, h: (s: string) => void) => {
      handler = h;
      return { remove };
    }) as never);
    return { fire: (s: string) => handler(s), remove };
  };

  it('checks when the app returns after the interval, not before, and not in the background', () => {
    let now = 1_000_000;
    const app = listen();
    const stop = startForegroundUpdates(() => now);
    now += CHECK_EVERY_MS - 1;
    app.fire('active');
    expect(mocked.checkForUpdateAsync).not.toHaveBeenCalled();
    now += 1;
    app.fire('background');
    expect(mocked.checkForUpdateAsync).not.toHaveBeenCalled();
    app.fire('active');
    expect(mocked.checkForUpdateAsync).toHaveBeenCalledTimes(1);
    stop();
    expect(app.remove).toHaveBeenCalled();
  });
});
