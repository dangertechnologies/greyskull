import { NativeTabs } from 'expo-router/native-tabs';
import { useEffect } from 'react';
import { useTheme } from '../../src/design/theme';
import { startHealthSync } from '../../src/health';

/** Dev builds only: one line showing which native modules linked (the native modules do not exist in Jest). */
async function logNativeModules() {
  const [intents, ai, keepAwake] = await Promise.allSettled([
    import('expo-app-intents').then((m) => m.isAvailable()),
    import('expo-ai').then((m) => m.getAvailabilityAsync()),
    import('expo-keep-awake').then((m) => m.isAvailableAsync()),
  ]);
  const show = (r: PromiseSettledResult<unknown>) =>
    r.status === 'fulfilled' ? JSON.stringify(r.value) : `error: ${String(r.reason)}`;
  console.log(`[native] appIntents=${show(intents)} onDeviceModel=${show(ai)} keepAwake=${show(keepAwake)}`);
}

/** The only file that imports the native tabs API. */
export default function TabsLayout() {
  const t = useTheme();
  useEffect(() => {
    if (__DEV__ && !process.env.JEST_WORKER_ID) void logNativeModules();
  }, []);
  // The tabs mount once the saved data has loaded, so the sync never reads a half-loaded store.
  useEffect(() => startHealthSync(), []);
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
