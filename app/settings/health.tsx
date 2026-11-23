import { Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { useTheme } from '../../src/design/theme';
import {
  describeHealth,
  exportSummary,
  getHealthSync,
  lastSyncLabel,
  useHealthStatus,
} from '../../src/health';
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
  // Ask the system on opening; coming back from its Settings screen is handled for the whole app.
  useEffect(refresh, [refresh]);

  const onExport = async () => {
    setExporting(true);
    setExportNote(null);
    try {
      const result = await sync.exportPast();
      setExportNote(result.permission !== 'granted' ? 'Health access is off.' : exportSummary(result));
    } catch {
      setExportNote('Some workouts could not be sent. Try again later.');
    } finally {
      setExporting(false);
    }
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

      {status.lastError && healthSync && !view.banner ? (
        <Button title="Try again now" variant="secondary" onPress={() => void sync.retryNow()} />
      ) : null}

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
        Sends the finished workouts that are not in Health yet. Running it twice is harmless: each workout
        keeps one entry.
      </Text>
      <Text color="textMuted">{view.privacyNote}</Text>
    </ScreenScroll>
  );
}
