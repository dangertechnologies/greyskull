import { findIndex, isEqual, round } from 'lodash';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Grid } from '../../Components/Layout';

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

  unit: { fontSize: 30, fontWeight: '100', color: '#FFFFFF', marginBottom: 20 },

  valueLabel: {
    color: '#FFFFFF',
    fontSize: 114,
    fontWeight: '100',
    minWidth: 124,
    textAlign: 'center',
  },

  valueLabelSmall: {
    color: '#FFFFFF',
    fontSize: 80,
    fontWeight: '100',
    minWidth: 120,
    textAlign: 'center',
  },
});

class DataValueDisplay extends React.PureComponent<IDataValueDisplayProps> {
  public increaseTimer: ReturnType<typeof setTimeout> | null = null;
  public decreaseTimer: ReturnType<typeof setTimeout> | null = null;

  public increase = () => {
    this.props.onChange(Number(this.props.value) + this.props.step);
    this.increaseTimer = setTimeout(this.increase, 100);
  };

  public decrease = () => {
    const newWeight = Number(this.props.value) - this.props.step;
    this.props.onChange(newWeight > 0 ? newWeight : 0);
    this.increaseTimer = setTimeout(this.decrease, 100);
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
      <Grid row vertical="center">
        <Grid size={1} vertical="center">
          {allowInput && (
            <TouchableOpacity onPressIn={this.decrease} onPressOut={this.stopTimers}>
              <Ionicons name="ios-remove" size={40} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </Grid>
        <Grid row size={10} vertical="bottom" horizontal="center" style={{ paddingLeft: 30 }}>
          <Text
            allowFontScaling
            style={`${value}`.length > 3 ? styles.valueLabelSmall : styles.valueLabel}
          >
            {value}
          </Text>
          <Text style={styles.unit}>{unit}</Text>
        </Grid>
        <Grid size={1} vertical="center" horizontal="right">
          {allowInput && (
            <TouchableOpacity onPressIn={this.increase} onPressOut={this.stopTimers}>
              <Ionicons name="ios-add" size={40} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </Grid>
      </Grid>
    );
  }
}

export default DataValueDisplay;
