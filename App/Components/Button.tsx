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
    alignItems: 'center',
    borderColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    height: 56,
    justifyContent: 'center',
    width: '100%',
  },
  label: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '200',
  },
});

export default Btn;
