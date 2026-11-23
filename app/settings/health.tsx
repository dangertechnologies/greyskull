import { Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform, View } from 'react-native';
import { useTheme } from '../../src/design/theme';
import { describeHealth, getHealthSync, lastSyncLabel, useHealthStatus } from '../../src/health';
import { useStore } from '../../src/store';
import { Button } from '../../src/ui/Button';
import { Icon } from '../../src/ui/Icon';
import { ListRow } from '../../src/ui/ListRow';
import { ScreenScroll } from '../../src/ui/layout';
import { Section } from '../../src/ui/Section';
import { Text } from '../../src/ui/Text';

export default function HealthSettings() {
  const t = useTheme();
  const healthSync = useStore((s) => s.healthSync);
  const writtenCount = useStore((s) => s.sessions.filter((l) => l.healthId).length);
  const status = useHealthStatus();
  const sync = getHealthSync();
  const [exporting, setExporting] = useState(false);
  const [exportNote, setExportNote] = useState<string | null>(null);
  const view = describeHealth({ os: Platform.OS, healthSync, status });

  const refresh = useCallback(() => void sync.refreshPermission(), [sync]);
  // Ask the system on opening and again when the user comes back from its Settings screen.
  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', (state) => state === 'active' && refresh());
    return () => sub.remove();
  }, [refresh]);

  const onExport = async () => {
    setExporting(true);
    setExportNote(null);
    const result = await sync.exportPast();
    setExporting(false);
    setExportNote(
      result.failed
        ? 'Some workouts could not be sent. Try again later.'
        : result.permission !== 'granted'
          ? 'Health access is off.'
          : `Sent ${result.written} ${result.written === 1 ? 'workout' : 'workouts'}.`,
    );
  };

  return (
    <ScreenScroll gap={5}>
      <Stack.Screen options={{ title: view.title }} />
      <Section card>
        <ListRow
          title="Save workouts to Health"
          subtitle={view.toggleSubtitle}
          accessory="switch"
          switchValue={healthSync}
          onSwitch={(on) => {
            if (on) void sync.enable();
            else sync.disable();
          }}
        />
      </Section>

      {view.banner ? (
        <View
          accessibilityRole="alert"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: t.space[4],
            padding: t.space[5],
            borderRadius: t.radius.xl,
            borderWidth: 1.5,
            borderColor: t.color.danger,
            backgroundColor: t.color.surface,
          }}
        >
          <Icon name="dont" color="danger" />
          <Text style={{ flex: 1 }}>{view.banner}</Text>
        </View>
      ) : null}
      {view.settingsButton ? <Button title={view.settingsButton} onPress={sync.openSettings} /> : null}

      <Section card>
        {view.banner ? null : (
          <ListRow title="Permission" subtitle="Workouts · write only" value={view.permissionLabel} />
        )}
        <ListRow title="Last sync" subtitle={lastSyncLabel(status, writtenCount)} />
      </Section>

      <Button
        title={exporting ? 'Sending…' : 'Export past workouts'}
        variant="secondary"
        icon="import"
        disabled={!view.exportEnabled || exporting}
        onPress={() => void onExport()}
      />
      {exportNote ? (
        <Text accessibilityLiveRegion="polite" color="textMuted">
          {exportNote}
        </Text>
      ) : null}

      <Text color="textMuted">
        Sends every finished workout to Health. Running it twice is harmless: each workout keeps one entry.
      </Text>
      <Text color="textMuted">
        Workouts are written to Health on this device. Nothing leaves your phone, and Greyskull never reads
        from Health.
      </Text>
    </ScreenScroll>
  );
}
