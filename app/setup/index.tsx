import { Text } from 'react-native';
import { Button } from '../../src/components/Button';
import { Screen } from '../../src/components/Screen';
import { TEMPLATES } from '../../src/domain';
import { useStore } from '../../src/store';
import { type } from '../../src/theme';

// Temporary stub, replaced by the full onboarding flow in Session 6.
export default function SetupStub() {
  return (
    <Screen>
      <Text style={type.title}>Setup coming in Session 6</Text>
      {__DEV__ ? (
        <Button title="Use Base GSLP defaults" onPress={() => useStore.getState().setProgram(TEMPLATES.base)} />
      ) : null}
    </Screen>
  );
}
