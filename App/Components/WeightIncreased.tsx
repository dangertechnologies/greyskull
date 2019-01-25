import LottieView from 'lottie-react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import { Text, View } from 'react-native-animatable';
// @ts-ignore
import { AnimatedCircularProgress } from 'react-native-circular-progress';
import { ScreenTitle } from './Layout';

interface IWeightIncreasedProps {
  fromWeight: number;
  toWeight: number;
  title: string;
  onDone(): any;
}

interface IWeightIncreasedState {
  weight: number;
}

class WeightIncreased extends React.Component<IWeightIncreasedProps, IWeightIncreasedState> {
  public state: IWeightIncreasedState = {
    weight: 0,
  };

  public _container: View | null = null;
  public intervalId: ReturnType<typeof setInterval> | null = null;

  public componentDidMount() {
    this.setState({
      weight: this.props.fromWeight,
    });

    if (this._container && this._container.transitionTo) {
      this._container.transitionTo({ opacity: 0.7 });
    }
  }

  public increaseWeight = () => {
    this.setState(
      {
        weight: this.state.weight + 0.1,
      },
      () => {
        if (this.intervalId && this.state.weight >= this.props.toWeight) {
          clearInterval(this.intervalId);
        }
      }
    );
  };

  public render(): JSX.Element {
    return (
      <View
        style={{
          ...StyleSheet.absoluteFillObject,
          alignItems: 'center',
          backgroundColor: 'black',
          flex: 1,
          justifyContent: 'center',
          opacity: 0,
        }}
        ref={(c: any) => {
          this._container = c;
        }}
      >
        <View animation="fadeIn">
          <View
            animation="slideInUp"
            duration={800}
            style={{ color: 'white', marginTop: -200, fontSize: 30, fontWeight: '300' }}
          >
            <ScreenTitle title={this.props.title} subtitle="Weight increased" />
          </View>
        </View>

        <View
          animation="fadeIn"
          delay={800}
          onAnimationBegin={() => {
            this.intervalId = setInterval(this.increaseWeight, 25);
          }}
        >
          <AnimatedCircularProgress
            size={120}
            width={3}
            fill={
              Number(
                (this.state.weight - this.props.fromWeight) /
                  (this.props.toWeight - this.props.fromWeight)
              ) * 100
            }
            tintColor="#FFFFFF"
            onAnimationComplete={() => {
              setTimeout(
                () =>
                  this._container && this._container.fadeOut
                    ? this._container.fadeOut().then(this.props.onDone)
                    : null,
                1000
              );
            }}
            backgroundColor="rgba(255, 255, 255, 0.2)"
          >
            {() => (
              <Text style={{ fontSize: 36, fontWeight: '100', color: '#FFFFFF' }}>{`${parseFloat(
                (this.state.weight || 0).toString()
              ).toFixed(1)}kg`}</Text>
            )}
          </AnimatedCircularProgress>
        </View>

        {this.state.weight >= this.props.toWeight && (
          <View animation="fadeIn" delay={300}>
            <LottieView
              autoSize
              style={{ width: 144, marginTop: 0 }}
              autoPlay
              loop={false}
              source={require('../Images/trophy.json')}
            />
          </View>
        )}
      </View>
    );
  }
}

export default WeightIncreased;
