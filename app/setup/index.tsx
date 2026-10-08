import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../src/components/Button';
import { Screen } from '../../src/components/Screen';
import { type } from '../../src/theme';

export default function Welcome() {
  return (
    <Screen image="empty-gym">
      <View style={styles.top}>
        <Text style={type.title} accessibilityRole="header">Greyskull LP</Text>
        <Text style={type.body}>A simple linear program: three lifts a session, add weight every time you hit your reps.</Text>
        <Text style={type.body}>The last set of each lift is AMRAP: as many reps as you can. Five or more and the weight goes up; ten or more and it goes up double.</Text>
        <Text style={type.body}>Fail twice in a row and you drop back 10 % and build up again.</Text>
      </View>
      <Button title="Get started" onPress={() => router.push('/setup/units')} />
    </Screen>
  );
}

const styles = StyleSheet.create({ top: { gap: 16, paddingTop: 48, paddingBottom: 32 } });
