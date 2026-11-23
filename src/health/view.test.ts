import { type HealthStatus, initialHealthStatus } from './status';
import { describeHealth, lastSyncLabel } from './view';

const status = (patch: Partial<HealthStatus> = {}): HealthStatus => ({ ...initialHealthStatus(), ...patch });
const NOW = new Date(2026, 10, 23, 15, 0);

describe('describeHealth', () => {
  it('shows the allowed state with export enabled', () => {
    const v = describeHealth({ os: 'ios', healthSync: true, status: status({ permission: 'granted' }) });
    expect(v).toMatchObject({
      title: 'Apple Health',
      permissionLabel: 'Allowed',
      banner: null,
      exportEnabled: true,
      toggleSubtitle: 'Each finished workout is written once',
    });
  });

  it('shows the denied state with a banner, the settings button and export disabled', () => {
    const v = describeHealth({ os: 'ios', healthSync: false, status: status({ permission: 'denied' }) });
    expect(v.toggleSubtitle).toBe('Waiting for permission');
    expect(v.banner).toBe(
      'Health access is off for Greyskull. Allow it under Settings, Health, Data Access.',
    );
    expect(v.settingsButton).toBe('Open system Settings');
    expect(v.exportEnabled).toBe(false);
    expect(v.permissionLabel).toBe('Not allowed');
  });

  it('treats an unanswered permission as blocked once sync is on (Android never says denied)', () => {
    const v = describeHealth({
      os: 'android',
      healthSync: true,
      status: status({ permission: 'undetermined' }),
    });
    expect(v.title).toBe('Health Connect');
    expect(v.banner).toContain('Health Connect');
    expect(v.settingsButton).toBe('Open Health Connect');
  });

  it('shows no banner before the first request', () => {
    const v = describeHealth({
      os: 'ios',
      healthSync: false,
      status: status({ permission: 'undetermined' }),
    });
    expect(v.banner).toBeNull();
    expect(v.permissionLabel).toBe('Not asked yet');
  });

  it('says so when Health is not available', () => {
    const v = describeHealth({ os: 'ios', healthSync: false, status: status({ permission: 'unavailable' }) });
    expect(v.banner).toBe('Health is not available on this device.');
    expect(v.settingsButton).toBeNull();
    expect(v.exportEnabled).toBe(false);
  });
});

describe('lastSyncLabel', () => {
  it('reports a failure with the retry note', () => {
    const at = new Date(2026, 10, 22, 9, 12).toISOString();
    expect(lastSyncLabel(status({ lastError: { at, message: 'x' } }), 3, NOW)).toMatch(
      /^Failed 22 Nov · will retry on next launch$/,
    );
  });

  it('reports a success with the count, today as a time', () => {
    const at = new Date(2026, 10, 23, 9, 12).toISOString();
    const label = lastSyncLabel(status({ lastSyncAt: at }), 124, NOW);
    expect(label).toMatch(/^Today .*9.*12.* · 124 workouts$/);
    expect(lastSyncLabel(status({ lastSyncAt: at }), 1, NOW)).toMatch(/ · 1 workout$/);
  });

  it('reports an earlier day as a date', () => {
    const at = new Date(2026, 10, 20, 9, 12).toISOString();
    expect(lastSyncLabel(status({ lastSyncAt: at }), 2, NOW)).toBe('20 Nov · 2 workouts');
  });

  it('says nothing was written yet', () => {
    expect(lastSyncLabel(status(), 0, NOW)).toBe('Nothing written yet');
  });
});
