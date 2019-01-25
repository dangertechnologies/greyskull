import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

interface IFormDescriptionProps {
  hints: string[];
  bad?: boolean;
}

const styles = StyleSheet.create({
  container: {},
  hint: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '100',
    paddingLeft: 5,
  },

  icon: {},

  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '100',
    marginBottom: 10,
    textAlign: 'center',
  },
  titleContainer: {},
});

const Item = ({ bad, children }: { bad: boolean; children: React.ReactNode }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
    <Ionicons
      size={20}
      style={styles.icon}
      name={bad ? 'ios-close' : 'ios-checkmark'}
      color={bad ? 'red' : 'green'}
    />
    <Text style={styles.hint} adjustsFontSizeToFit>
      {children}
    </Text>
  </View>
);

const FormDescription = ({ hints, bad }: IFormDescriptionProps) => (
  <>
    <View style={styles.titleContainer}>
      <Text style={styles.title}>{bad ? 'Dont' : 'Do'}</Text>
    </View>

    <View style={styles.container}>
      {hints.map(hint => (
        <Item bad={!!bad}>{hint}</Item>
      ))}
    </View>
  </>
);
export default FormDescription;
