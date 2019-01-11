import React from 'react';
import { StyleSheet, Text, TouchableOpacity, TouchableOpacityProps } from 'react-native';

interface IButtonProps extends TouchableOpacityProps {
  children: React.ReactNode;
}

const Btn = (props: IButtonProps) => {
  const { children, ...rest } = props;
  return (
    <TouchableOpacity {...rest} style={styles.button}>
      <Text style={styles.label}>{children}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#FFFFFF',
    padding: 20,
    width: '100%',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 20,
    fontWeight: '200',
    color: '#FFFFFF',
  },
});

export default Btn;
