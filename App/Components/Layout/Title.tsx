import React from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';

interface ITitleProps {
  title: string;
  center?: boolean;
  subtitle?: string;
  supertitle?: string;
  containerStyle?: object;
}

const { width } = Dimensions.get('screen');

const Title = ({ title, subtitle, supertitle, center, containerStyle }: ITitleProps) => (
  <View style={[styles.titleContainer, containerStyle]}>
    <Text style={[styles.supertitle, center && { textAlign: 'center' }]}>{supertitle}</Text>
    <Text
      style={[
        styles.title,
        center && { textAlign: 'center' },
        title.length > 13 ? { fontSize: 40 } : {},
      ]}
    >
      {title}
    </Text>
    <View style={styles.line} />
    {subtitle && (
      <Text style={[styles.subtitle, center && { textAlign: 'center' }]}>{subtitle}</Text>
    )}
  </View>
);

const styles = StyleSheet.create({
  titleContainer: {
    alignItems: 'center',
    marginHorizontal: 35,
    marginTop: 50,
    width: width - 70,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 48,
    fontWeight: '100',
  },
  subtitle: {
    fontWeight: '100',
    color: '#FFFFFF',
    fontSize: 24,
  },
  supertitle: {
    color: '#FFFFFF',
    fontSize: 18,
  },
  line: {
    height: StyleSheet.hairlineWidth,
    width: width - 100,
    marginHorizontal: 50,
    marginVertical: 5,
    backgroundColor: '#FFFFFF',
  },
});

export default Title;
