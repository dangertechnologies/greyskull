import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { RulesEditor } from '../../src/components/RulesEditor';
import { goBackOr } from '../../src/navigation';
import { useProgram, useStore } from '../../src/store';
import { Button } from '../../src/ui/Button';
import { ScreenScroll } from '../../src/ui/layout';
import { Text } from '../../src/ui/Text';

export default function RulesScreen() {
  const params = useLocalSearchParams<{ program?: string }>();
  const program = useProgram(params.program);
  const updateRules = useStore((s) => s.updateRules);
  const [rules, setRules] = useState(program?.rules);
  if (!program || !rules) return null;
  return (
    <ScreenScroll gap={8}>
      <Stack.Screen options={{ title: 'Progression rules' }} />
      <Text color="textMuted">Changes apply from your next workout. Your history stays as it is.</Text>
      <RulesEditor card rules={rules} onChange={setRules} />
      <Button
        title="Save"
        onPress={() => {
          updateRules(program.id, rules);
          goBackOr('/');
        }}
      />
    </ScreenScroll>
  );
}
