import type { HealthWorkout } from './workout';

const workout = (patch: Partial<HealthWorkout> = {}): HealthWorkout => ({
  id: 'greyskull-2026-11-20T08:00:00.000Z-7',
  version: 1_795_000_000_000,
  start: new Date('2026-11-20T08:00:00.000Z'),
  end: new Date('2026-11-20T08:50:00.000Z'),
  title: 'Greyskull LP · Day A',
  activity: 'strength',
  ...patch,
});

function load(os: 'ios' | 'android' | 'web') {
  jest.resetModules();
  jest.doMock('react-native', () => ({
    Platform: { OS: os },
    Linking: { openSettings: jest.fn(async () => undefined) },
  }));
  return require('./platform') as typeof import('./platform');
}

describe('iOS Apple Health', () => {
  const hk = {
    isHealthDataAvailable: jest.fn(() => true),
    authorizationStatusFor: jest.fn(() => 0),
    requestAuthorization: jest.fn(async () => true),
    saveWorkoutSample: jest.fn(async () => ({ dispose: jest.fn() })),
    WorkoutActivityType: { traditionalStrengthTraining: 50, functionalStrengthTraining: 20 },
  };
  beforeEach(() => {
    jest.clearAllMocks();
    hk.isHealthDataAvailable.mockReturnValue(true);
    jest.doMock('@kingstinct/react-native-healthkit', () => hk);
  });

  it('maps the system answer for the workout type', async () => {
    const p = load('ios').createPlatform();
    hk.authorizationStatusFor.mockReturnValue(0);
    expect(await p?.permission()).toBe('undetermined');
    hk.authorizationStatusFor.mockReturnValue(1);
    expect(await p?.permission()).toBe('denied');
    hk.authorizationStatusFor.mockReturnValue(2);
    expect(await p?.permission()).toBe('granted');
    expect(hk.authorizationStatusFor).toHaveBeenCalledWith('HKWorkoutTypeIdentifier');
    hk.isHealthDataAvailable.mockReturnValue(false);
    expect(await p?.permission()).toBe('unavailable');
  });

  it('asks to write workouts only, never to read', async () => {
    const p = load('ios').createPlatform();
    hk.authorizationStatusFor.mockReturnValue(2);
    await p?.request();
    expect(hk.requestAuthorization).toHaveBeenCalledWith({
      toShare: ['HKWorkoutTypeIdentifier'],
      toRead: [],
    });
  });

  it('saves the workout with the sync identifier and version', async () => {
    const p = load('ios').createPlatform();
    await p?.write(workout());
    const [type, quantities, start, end, totals, metadata] = hk.saveWorkoutSample.mock.calls[0] as unknown[];
    expect(type).toBe(50);
    expect(quantities).toEqual([]);
    expect(start).toEqual(new Date('2026-11-20T08:00:00.000Z'));
    expect(end).toEqual(new Date('2026-11-20T08:50:00.000Z'));
    expect(totals).toBeUndefined();
    expect(metadata).toMatchObject({
      HKSyncIdentifier: 'greyskull-2026-11-20T08:00:00.000Z-7',
      HKSyncVersion: 1_795_000_000_000,
    });
  });

  it('uses functional strength training for the functional activity', async () => {
    const p = load('ios').createPlatform();
    await p?.write(workout({ activity: 'functional' }));
    expect((hk.saveWorkoutSample.mock.calls[0] as unknown[])[0]).toBe(20);
  });
});

describe('Android Health Connect', () => {
  const hc = {
    SdkAvailabilityStatus: { SDK_AVAILABLE: 3 },
    ExerciseType: { STRENGTH_TRAINING: 70, CALISTHENICS: 13 },
    RecordingMethod: { RECORDING_METHOD_MANUAL_ENTRY: 3 },
    getSdkStatus: jest.fn(async () => 3),
    initialize: jest.fn(async () => true),
    getGrantedPermissions: jest.fn(async () => [] as unknown[]),
    requestPermission: jest.fn(async () => [] as unknown[]),
    insertRecords: jest.fn(async () => ['id']),
    openHealthConnectSettings: jest.fn(),
  };
  const write = { accessType: 'write', recordType: 'ExerciseSession' };
  beforeEach(() => {
    jest.clearAllMocks();
    hc.getSdkStatus.mockResolvedValue(3);
    hc.getGrantedPermissions.mockResolvedValue([]);
    hc.requestPermission.mockResolvedValue([]);
    jest.doMock('react-native-health-connect', () => hc);
  });

  it('is unavailable without the Health Connect provider', async () => {
    hc.getSdkStatus.mockResolvedValue(1);
    expect(await load('android').createPlatform()?.permission()).toBe('unavailable');
  });

  it('reports granted only when the exercise write permission is held', async () => {
    const p = load('android').createPlatform();
    expect(await p?.permission()).toBe('undetermined');
    hc.getGrantedPermissions.mockResolvedValue([write]);
    expect(await p?.permission()).toBe('granted');
  });

  it('requests the exercise write permission only; a refusal is a denial', async () => {
    const p = load('android').createPlatform();
    expect(await p?.request()).toBe('denied');
    expect(hc.requestPermission).toHaveBeenCalledWith([write]);
    hc.requestPermission.mockResolvedValue([write]);
    expect(await p?.request()).toBe('granted');
  });

  it('inserts an exercise session with the client record id and version', async () => {
    const p = load('android').createPlatform();
    await p?.write(workout());
    expect(hc.insertRecords).toHaveBeenCalledWith([
      {
        recordType: 'ExerciseSession',
        startTime: '2026-11-20T08:00:00.000Z',
        endTime: '2026-11-20T08:50:00.000Z',
        exerciseType: 70,
        title: 'Greyskull LP · Day A',
        metadata: {
          clientRecordId: 'greyskull-2026-11-20T08:00:00.000Z-7',
          clientRecordVersion: 1_795_000_000_000,
          recordingMethod: 3,
        },
      },
    ]);
  });

  it('uses the calisthenics exercise type for the functional activity', async () => {
    const p = load('android').createPlatform();
    await p?.write(workout({ activity: 'functional' }));
    const [[[record]]] = hc.insertRecords.mock.calls as unknown as [[[{ exerciseType: number }]]];
    expect(record.exerciseType).toBe(13);
  });
});

it('has no platform on the web', () => {
  expect(load('web').createPlatform()).toBeNull();
});
