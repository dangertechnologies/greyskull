import { NativeTabs } from 'expo-router/native-tabs';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useTheme } from '../../src/design/theme';

/** Dev builds only: one line showing which native modules linked (the native modules do not exist in Jest). */
async function logNativeModules() {
  const [health, intents, ai, keepAwake] = await Promise.allSettled([
    Platform.OS === 'ios'
      ? import('@kingstinct/react-native-healthkit').then((m) => m.isHealthDataAvailable())
      : import('react-native-health-connect').then((m) => m.getSdkStatus()),
    import('expo-app-intents').then((m) => m.isAvailable()),
    import('expo-ai').then((m) => m.getAvailabilityAsync()),
    import('expo-keep-awake').then((m) => m.isAvailableAsync()),
  ]);
  const show = (r: PromiseSettledResult<unknown>) =>
    r.status === 'fulfilled' ? JSON.stringify(r.value) : `error: ${String(r.reason)}`;
  console.log(
    `[native] health=${show(health)} appIntents=${show(intents)} onDeviceModel=${show(ai)} keepAwake=${show(keepAwake)}`,
  );
}

/** The only file that imports the native tabs API. */
export default function TabsLayout() {
  const t = useTheme();
  useEffect(() => {
    if (__DEV__ && !process.env.JEST_WORKER_ID) void logNativeModules();
  }, []);
  return (
    <NativeTabs tintColor={t.color.accent}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Today</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="house" md="home" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="progress">
        <NativeTabs.Trigger.Label>Progress</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="chart.line.uptrend.xyaxis" md="show_chart" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="plan">
        <NativeTabs.Trigger.Label>Programs</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="list.bullet" md="list" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="gearshape" md="settings" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
