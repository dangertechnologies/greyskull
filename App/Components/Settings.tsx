import { flatten, mapValues } from 'lodash';
import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { createAnimatableComponent } from 'react-native-animatable';
import { BlurView as Blur } from 'react-native-blur';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { SafeAreaView } from 'react-navigation';
import { compose } from 'recompose';
import { IAppState, withApplicationState } from '../Store';
import Button from './Button';

import ExerciseIcon from './ExerciseIcon';
import { Grid, ScreenTitle } from './Layout';
import Chart from './Progress/Chart';

const BlurView = createAnimatableComponent(Blur);

interface ISettingsProps {
  open: boolean;
  title?: string;
  subtitle?: string;
  onClose(): any;
  onReset(): any;
}
interface ISettingsInnerProps extends ISettingsProps, IAppState {}

const styles = StyleSheet.create({
  closeIcon: { position: 'absolute', right: 0, top: 40 },
  container: {
    ...StyleSheet.absoluteFillObject,
    paddingHorizontal: 40,
  },
  exerciseName: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '100',
    marginBottom: -5,
    paddingTop: 5,
  },
  gridItem: { height: 60, marginVertical: 10 },
  icon: { height: 25, width: 25 },
  iconCircle: {
    alignItems: 'center',
    borderColor: '#FFFFFF',
    borderRadius: 28,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  noDataText: { color: '#FFFFFF', fontWeight: '100', fontSize: 20 },
  scrollContainer: { flex: 8.5 / 12 },
});

export class Screen extends React.PureComponent<ISettingsInnerProps> {
  public container: typeof BlurView | null = null;
  public onClose = () => {
    if (this.container && this.container.fadeOut && this.props.onClose) {
      this.container.fadeOut(500).then(() => this.props.onClose && this.props.onClose());
    }
  };
  public render() {
    const { store } = this.props;
    const { exercises } = this.props.store.configuration;

    if (!this.props.open) {
      return null;
    }

    const completedExercises = flatten(store.workoutPlan.map(workout => workout.exercises));
    return (
      <BlurView
        style={styles.container}
        ref={(c: any) => {
          this.container = c;
        }}
        blurAmount={25}
        animation="fadeOut"
        blurType="dark"
      >
        <SafeAreaView style={{ flex: 1 }}>
          <Grid size={2} vertical="center" horizontal="center">
            <ScreenTitle
              title={this.props.title || 'Status'}
              subtitle={this.props.subtitle}
              subtitleStyle={{ fontSize: 13, fontWeight: '100' }}
            />
          </Grid>
          <Grid size={0.5} />
          {this.props.onClose && (
            <TouchableOpacity onPress={this.onClose} style={styles.closeIcon}>
              <Ionicons name="ios-close" size={40} color="#FFFFFF" />
            </TouchableOpacity>
          )}
          <ScrollView style={styles.scrollContainer}>
            {Object.values(
              mapValues(exercises, (definition, key) => {
                const completed = completedExercises.filter(
                  e => e.definition === key && e.completed
                );

                if (definition.include === 'EXCLUDED' || definition.bodyweight) {
                  return null;
                }

                return (
                  <Grid
                    size={2}
                    key={key}
                    row
                    vertical="center"
                    horizontal="center"
                    style={styles.gridItem}
                  >
                    <Grid size={3} horizontal="center">
                      <View style={styles.iconCircle}>
                        <ExerciseIcon
                          style={styles.icon}
                          iconStyle={styles.icon}
                          name={definition.icon as any}
                        />
                      </View>
                      <Text style={styles.exerciseName}>{definition.shortName}</Text>
                    </Grid>

                    <Grid size={9} horizontal="center">
                      {completed.length < 2 ? (
                        <Text style={styles.noDataText}>No data available yet</Text>
                      ) : (
                        <Chart
                          showAnnotations="FIRST_LAST_CHART_ONLY"
                          exercises={completed}
                          height={40}
                        />
                      )}
                    </Grid>
                  </Grid>
                );
              })
            )}
          </ScrollView>
          <Grid size={1.5}>
            <Button
              onPress={() =>
                Alert.alert(
                  'Are you sure?',
                  'All your progress will be lost, and you will need to set up a new program',
                  [
                    { text: 'No thanks', onPress: () => null, style: 'cancel' },
                    {
                      text: 'Reset',
                      style: 'destructive',
                      onPress: () => {
                        if (this.props.onReset) {
                          this.props.onReset();
                          this.onClose();
                        }
                      },
                    },
                  ]
                )
              }
            >
              {' '}
              Reset
            </Button>
          </Grid>
        </SafeAreaView>
      </BlurView>
    );
  }
}

export default compose<ISettingsInnerProps, ISettingsProps>(withApplicationState)(Screen);
