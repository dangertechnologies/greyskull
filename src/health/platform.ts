import { Linking, Platform } from 'react-native';
import type { Permission } from './status';
import type { HealthPlatform } from './sync';
import type { HealthWorkout } from './workout';

/** The only place that imports the native Health modules; they are loaded on first use, never in tests or on the web. */

/** HKWorkoutTypeIdentifier: the one type Greyskull asks to write. It asks to read nothing. */
const WORKOUT_TYPE = 'HKWorkoutTypeIdentifier';

function appleHealth(): HealthPlatform {
  const hk = () =>
    require('@kingstinct/react-native-healthkit') as typeof import('@kingstinct/react-native-healthkit');
  const permission = async (): Promise<Permission> => {
    const m = hk();
    if (!m.isHealthDataAvailable()) return 'unavailable';
    // `AuthorizationStatus`: 0 not asked, 1 denied, 2 allowed (for write access this answer is exact).
    const status = m.authorizationStatusFor(WORKOUT_TYPE) as number;
    return status === 2 ? 'granted' : status === 1 ? 'denied' : 'undetermined';
  };
  return {
    permission,
    async request() {
      if ((await permission()) === 'unavailable') return 'unavailable';
      await hk().requestAuthorization({ toShare: [WORKOUT_TYPE], toRead: [] });
      return permission();
    },
    async write(w: HealthWorkout) {
      const m = hk();
      const type =
        w.activity === 'functional'
          ? m.WorkoutActivityType.functionalStrengthTraining
          : m.WorkoutActivityType.traditionalStrengthTraining;
      // HealthKit does not replace a workout that has the same sync identifier and a higher version (checked on
      // iOS 26: both stay), so remove this app's earlier write of the same id first, then save. Deleting by
      // metadata needs no read access and only ever touches samples this app saved. A crash between the two
      // steps leaves no copy, and the next attempt saves it.
      await m.deleteObjects(WORKOUT_TYPE, {
        metadata: {
          withMetadataKey: 'HKSyncIdentifier',
          operatorType: m.ComparisonPredicateOperator.equalTo,
          value: w.id,
        },
      });
      const saved = await m.saveWorkoutSample(type, [], w.start, w.end, undefined, {
        HKSyncIdentifier: w.id,
        HKSyncVersion: w.version,
        GreyskullTitle: w.title,
      });
      saved.dispose?.();
    },
    openSettings: () => void Linking.openSettings().catch(() => undefined),
  };
}

function healthConnect(): HealthPlatform {
  const hc = () => require('react-native-health-connect') as typeof import('react-native-health-connect');
  const WRITE = { accessType: 'write', recordType: 'ExerciseSession' } as const;
  let initialized = false;
  const ready = async (): Promise<boolean> => {
    const m = hc();
    if ((await m.getSdkStatus()) !== m.SdkAvailabilityStatus.SDK_AVAILABLE) return false;
    if (!initialized) initialized = await m.initialize();
    return initialized;
  };
  const hasWrite = (held: readonly object[]) =>
    held.some(
      (p) =>
        'recordType' in p &&
        p.recordType === WRITE.recordType &&
        'accessType' in p &&
        p.accessType === 'write',
    );
  return {
    async permission() {
      if (!(await ready())) return 'unavailable';
      // Health Connect does not say "denied", only what is held: before a request that is "not asked".
      return hasWrite(await hc().getGrantedPermissions()) ? 'granted' : 'undetermined';
    },
    async request() {
      if (!(await ready())) return 'unavailable';
      return hasWrite(await hc().requestPermission([WRITE])) ? 'granted' : 'denied';
    },
    async write(w: HealthWorkout) {
      const m = hc();
      // A record with the same client id and a higher client version replaces the earlier one.
      await m.insertRecords([
        {
          recordType: 'ExerciseSession',
          startTime: w.start.toISOString(),
          endTime: w.end.toISOString(),
          exerciseType:
            w.activity === 'functional' ? m.ExerciseType.CALISTHENICS : m.ExerciseType.STRENGTH_TRAINING,
          title: w.title,
          metadata: {
            clientRecordId: w.id,
            clientRecordVersion: w.version,
            recordingMethod: m.RecordingMethod.RECORDING_METHOD_MANUAL_ENTRY,
          },
        },
      ]);
    },
    openSettings: () => hc().openHealthConnectSettings(),
  };
}

/** The Health service of this device, or null where there is none (the web). */
export function createPlatform(): HealthPlatform | null {
  if (Platform.OS === 'ios') return appleHealth();
  if (Platform.OS === 'android') return healthConnect();
  return null;
}
