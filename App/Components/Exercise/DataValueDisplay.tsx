import { findIndex, isEqual, round } from 'lodash';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

interface IDataValueDisplayProps {
  value: number | string;
  unit: string;
  allowInput?: boolean;
  step: number;
  onChange(value: number | string): any;
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-evenly',
  },

  unit: { fontSize: 30, fontWeight: '100', color: '#FFFFFF', marginBottom: 10 },

  valueLabel: {
    color: '#FFFFFF',
    fontSize: 72,
    minWidth: 120,
    paddingLeft: 50,
    textAlign: 'center',
  },

  decreaseControl: {},
  increaseControl: {},

  value: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    flexDirection: 'row',
  },
});

class DataValueDisplay extends React.PureComponent<IDataValueDisplayProps> {
  public increaseTimer: ReturnType<typeof setTimeout> | null = null;
  public decreaseTimer: ReturnType<typeof setTimeout> | null = null;

  public increase = () => {
    this.props.onChange(Number(this.props.value) + this.props.step);
    this.increaseTimer = setTimeout(this.increase, 50);
  };

  public decrease = () => {
    this.props.onChange(Number(this.props.value) - this.props.step);
    this.increaseTimer = setTimeout(this.decrease, 50);
  };

  public stopTimers = () => {
    if (this.increaseTimer) {
      clearTimeout(this.increaseTimer);
      this.increaseTimer = null;
    }

    if (this.decreaseTimer) {
      clearTimeout(this.decreaseTimer);
      this.decreaseTimer = null;
    }
  };

  public render(): JSX.Element {
    const { allowInput, step, value, onChange, unit } = this.props;
    return (
      <View style={styles.container}>
        {allowInput && (
          <TouchableOpacity
            style={styles.decreaseControl}
            onPressIn={this.decrease}
            onPressOut={this.stopTimers}
          >
            <Ionicons name="ios-remove" size={40} color="#FFFFFF" />
          </TouchableOpacity>
        )}
        <View style={styles.value}>
          <Text allowFontScaling style={styles.valueLabel}>
            {value}
          </Text>
          <Text style={styles.unit}>{unit}</Text>
        </View>
        {allowInput && (
          <TouchableOpacity
            style={styles.increaseControl}
            onPressIn={this.increase}
            onPressOut={this.stopTimers}
          >
            <Ionicons name="ios-add" size={40} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>
    );
  }
}

export default DataValueDisplay;
