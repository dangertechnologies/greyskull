import React from 'react';
import { Dimensions, StyleSheet, Text, TextProps } from 'react-native';
import { View } from 'react-native-animatable';

interface ITitleProps {
  title: string;
  center?: boolean;
  subtitle?: string;
  supertitle?: string;
  containerStyle?: object;
  subtitleStyle?: TextProps['style'];
}

const { width } = Dimensions.get('screen');

const Title = ({
  title,
  subtitle,
  supertitle,
  center,
  subtitleStyle,
  containerStyle,
}: ITitleProps) => (
  <View style={[styles.titleContainer, containerStyle]} animation="fadeIn">
    <View style={{ alignItems: 'flex-start' }}>
      <Text style={[styles.supertitle]}>{supertitle}</Text>
      <Text style={[styles.title, title.length > 13 ? { fontSize: 40 } : {}]}>{title}</Text>
    </View>
    <View style={styles.line} />
    {!subtitle ? null : (
      <Text style={[styles.subtitle, subtitleStyle || {}, center && { textAlign: 'center' }]}>
        {subtitle}
      </Text>
    )}
  </View>
);

const styles = StyleSheet.create({
  line: {
    backgroundColor: '#FFFFFF',
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 50,
    marginVertical: 5,
    width: width - 100,
  },
  subtitle: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '300',
  },
  supertitle: {
    color: '#FFFFFF',
    fontSize: 18,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 48,
    fontWeight: '100',
  },
  titleContainer: {
    alignItems: 'center',
  },
});

export default Title;
