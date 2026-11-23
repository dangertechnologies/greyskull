import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '../../src/design/theme';
import { importPlan, MAX_IMPORT_CHARS } from '../../src/planShare';
import { useStore } from '../../src/store';
import { Button } from '../../src/ui/Button';
import { BottomBar, ScreenScroll } from '../../src/ui/layout';
import { Text } from '../../src/ui/Text';
import { TextField } from '../../src/ui/TextField';

/** Add a program someone shared as JSON (pasted or from a file) to "My programs". */
export default function ImportPlan() {
  const t = useTheme();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const run = (raw: string) => {
    const store = useStore.getState();
    const result = importPlan(raw, { exercises: store.exercises, customPlans: store.customPlans });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    // Its exercises first, as saving a program checks them; a failure takes them out again.
    const added: string[] = [];
    try {
      for (const e of result.exercises) {
        store.upsertExercise(e);
        added.push(e.id);
      }
      store.saveCustomPlan(result.plan);
    } catch (e) {
      for (const id of added) useStore.getState().deleteExercise(id);
      setError(e instanceof Error ? e.message : String(e));
      return;
    }
    router.replace(`/builder/${result.plan.id}`);
  };

  const paste = async () => {
    try {
      const clip = await Clipboard.getStringAsync();
      if (clip.length > MAX_IMPORT_CHARS) {
        // Cut before it reaches the box, so a huge clipboard never freezes the field.
        setText(clip.slice(0, MAX_IMPORT_CHARS));
        setError(
          `The clipboard text is longer than the limit (${MAX_IMPORT_CHARS / 1000} kB), so only the first part was pasted. A program is much shorter than that.`,
        );
      } else {
        setText(clip);
        setError(null);
      }
    } catch (e) {
      setError(`The clipboard could not be read: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const pickFile = async () => {
    try {
      const picked = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain'] });
      const asset = picked.assets?.[0];
      if (picked.canceled || !asset) return;
      // The text is at most a few bytes per character; refuse a huge file before reading it.
      if (asset.size !== undefined && asset.size > MAX_IMPORT_CHARS * 4) {
        setError(`That file is too large to be a program (the limit is ${MAX_IMPORT_CHARS / 1000} kB).`);
        return;
      }
      run(await new File(asset.uri).text());
    } catch (e) {
      setError(`The file could not be read: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.color.background }}>
      <Stack.Screen options={{ title: 'Import a program' }} />
      <ScreenScroll withBottomBar gap={6}>
        <Text color="textMuted">
          Paste the text of a program someone shared, or choose its file. It is added to My programs; nothing
          starts until you start it.
        </Text>
        <TextField
          label="Shared program"
          value={text}
          onChangeText={(v) => {
            setText(v);
            setError(null);
          }}
          multiline
          maxLength={MAX_IMPORT_CHARS}
          autoCorrect={false}
          autoCapitalize="none"
          placeholder='{"format": "greyskull-plan", ...}'
          style={{ minHeight: 160 }}
        />
        {error ? (
          <Text color="danger" accessibilityLiveRegion="polite" testID="import-error">
            {error}
          </Text>
        ) : null}
        <View style={{ gap: t.space[2] }}>
          <Button title="Paste from clipboard" variant="secondary" onPress={() => void paste()} />
          <Button title="Choose a file" variant="secondary" onPress={() => void pickFile()} />
        </View>
      </ScreenScroll>
      <BottomBar>
        <Button title="Import" size="lg" disabled={text.trim().length === 0} onPress={() => run(text)} />
      </BottomBar>
    </View>
  );
}
