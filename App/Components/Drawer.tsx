import React from 'react';
import {
  Animated,
  Dimensions,
  Keyboard,
  PanResponder,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { View as AnimatedView } from 'react-native-animatable';
import Ionicons from 'react-native-vector-icons/Ionicons';

export interface IDrawerProps {
  children: React.ReactNode;
  // tslint:disable-next-line
  snapTo: Array<string | number>;
  initialSnapIndex: number;
  avoidKeyboard: boolean;
  backgroundColor?: string;
  onOutOfScreen?(): any;
}

interface IDrawerState {
  visibleKeyboardHeight: 0;
}

const { height: screenHeight } = Dimensions.get('window');

class Drawer extends React.Component<IDrawerProps, IDrawerState> {
  public static defaultProps = {
    avoidKeyboard: true,
    initialSnapIndex: 1,
    snapTo: [100, '40%', '90%'],
  };

  public state: IDrawerState = {
    visibleKeyboardHeight: 0,
  };

  private _keyboardWillShowSubscription: any | null = null;
  private _keyboardWillHideSubscription: any | null = null;
  private fingerPosition = new Animated.Value(screenHeight);

  private panResponder = PanResponder.create({
    // Ask to be the responder:
    onMoveShouldSetPanResponder: (evt, gestureState) => true,
    onMoveShouldSetPanResponderCapture: (evt, gestureState) => true,
    onPanResponderTerminationRequest: (evt, gestureState) => true,
    onStartShouldSetPanResponder: (evt, gestureState) => true,
    onStartShouldSetPanResponderCapture: (evt, gestureState) => true,

    // Sets this.fingerPosition to where the finger
    // is positioned while dragging
    onPanResponderMove: Animated.event([
      {
        nativeEvent: {
          pageY: this.fingerPosition,
        },
      },
    ]),

    onPanResponderRelease: evt => this.snapToClosest(evt.nativeEvent.pageY),
    onPanResponderTerminate: (evt, gestureState) => {
      // Another component has become the responder, so this gesture
      // should be cancelled
    },
  });

  public componentWillUnmount() {
    this.snapToHeight(0);

    if (this._keyboardWillHideSubscription) {
      this._keyboardWillHideSubscription.remove();
    }

    if (this._keyboardWillShowSubscription) {
      this._keyboardWillShowSubscription.remove();
    }
  }

  public componentDidMount() {
    this._keyboardWillShowSubscription = Keyboard.addListener(
      'keyboardDidShow',
      this.keyboardWillShow
    );
    this._keyboardWillHideSubscription = Keyboard.addListener(
      'keyboardDidHide',
      this.keyboardWillHide
    );

    if (
      this.props.initialSnapIndex !== undefined &&
      this.props.snapTo.length > this.props.initialSnapIndex
    ) {
      this.snapToHeight(
        this.absoluteHeightFromSnapValue(this.props.snapTo[this.props.initialSnapIndex])
      );
    }
  }

  public render(): JSX.Element {
    const height = this.fingerPosition.interpolate({
      extrapolate: 'clamp',
      inputRange: [0, screenHeight],
      outputRange: [screenHeight, this.state.visibleKeyboardHeight],
    });

    return (
      <AnimatedView
        // @ts-ignore
        style={[
          styles.outerContainer,
          {
            height,
            // tslint:disable-next-line
            backgroundColor: 'white',
          },
        ]}
      >
        <View style={styles.shadow}>
          <View style={[styles.transparent, styles.content]}>
            <View style={styles.dragHandleContainer} {...this.panResponder.panHandlers}>
              <TouchableOpacity style={{ height: 20 }}>
                <Ionicons name="ios-reorder" style={styles.dragHandle} size={24} />
              </TouchableOpacity>
            </View>
            <View style={[styles.transparent, { flexGrow: 1 }]}>{this.props.children}</View>
          </View>
        </View>
      </AnimatedView>
    );
  }

  private snapToHeight = (height: number) => {
    Animated.timing(this.fingerPosition, {
      toValue: screenHeight - height,
    }).start();

    if (height <= 0) {
      if (this.props.onOutOfScreen) {
        this.props.onOutOfScreen();
      }
    }
  };

  /**
   * Calculates the real height from a string (or a number). If e.g 50% is
   * given, then return what 50% of the current screenHeight would be as a
   * number
   */
  private absoluteHeightFromSnapValue = (value: number | string): number => {
    if (typeof value === 'string') {
      if (/%/.test(value)) {
        return (parseInt(value.replace('%', ''), 10) / 100) * screenHeight;
      }
      return parseInt(value, 10);
    }
    return value;
  };

  /**
   * Find which height to snap to by calculating which height
   * would have the closest position to the finger position
   */
  private snapToClosest = (fingerPosition: number) => {
    // Drawer snaps to positions depending on the given props.
    // Positions can either be given as percentage, or as numbers.

    // Calculate snap positions as numbers:
    // tslint:disable-next-line
    const snapTo: Array<number | string> = this.props.snapTo;
    const snapHeights: number[] = snapTo.map(this.absoluteHeightFromSnapValue);

    // Sort heights by order of distance to the finger
    const closestHeight = snapHeights.sort(
      (a: number, b: number) =>
        Math.abs(fingerPosition - (screenHeight - a)) -
        Math.abs(fingerPosition - (screenHeight - b))
    )[0];

    this.snapToHeight(closestHeight);
  };

  private keyboardWillShow = (e: any) => {
    this.setState({ visibleKeyboardHeight: e.endCoordinates.height });
  };

  private keyboardWillHide = (e: any) =>
    this.props.avoidKeyboard && this.setState({ visibleKeyboardHeight: 0 });
}

const styles = StyleSheet.create({
  content: {
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    flex: 1,
    paddingTop: 10,
  },

  dragHandle: {
    color: '#CCCCCC',
    fontSize: 24,
  },

  dragHandleContainer: {
    alignItems: 'center',
    height: 20,
    justifyContent: 'center',
    width: '100%',
  },
  shadow: {
    borderRadius: 20,
    flex: 1,
  },

  outerContainer: {
    borderRadius: 20,
    bottom: 0,
    position: 'absolute',
    width: '100%',
  },
  transparent: { backgroundColor: 'transparent' },
});

export default Drawer;
