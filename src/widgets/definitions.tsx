import { Text, VStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle, frame, monospacedDigit, padding } from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity, createWidget } from 'expo-widgets';
import type { NextWorkoutProps, RestProps } from './summary';

/**
 * Widget layouts. Each function marked 'widget' is compiled to a string by babel-preset-expo and run inside
 * the widget extension's own JS runtime, so it can only use what that runtime provides: the @expo/ui SwiftUI
 * components and modifiers as globals, plus its own props. No imports, no helpers from this file, no theme.
 * Colours therefore use system semantic styles (`primary`, `secondary`) and a fixed lime accent.
 */

function nextWorkoutLayout(props: NextWorkoutProps) {
  'widget';
  return (
    <VStack
      alignment="leading"
      spacing={4}
      modifiers={[padding({ all: 12 }), frame({ maxWidth: 10000, alignment: 'leading' })]}
    >
      <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle('secondary')]}>
        {props.inProgress ? 'IN PROGRESS' : props.subtitle.toUpperCase()}
      </Text>
      <Text modifiers={[font({ size: 20, weight: 'bold' })]}>{props.title}</Text>
      {props.lines.map((line) => (
        <Text key={line} modifiers={[font({ size: 14, weight: 'regular' }), foregroundStyle('primary')]}>
          {line}
        </Text>
      ))}
    </VStack>
  );
}

function restLayout(props: RestProps) {
  'widget';
  const range = { lower: new Date(props.startsAt), upper: new Date(props.endsAt) };
  const timer = (size: number) => (
    <Text
      timerInterval={range}
      countsDown
      modifiers={[font({ size, weight: 'bold', design: 'rounded' }), monospacedDigit()]}
    />
  );
  return {
    banner: (
      <VStack alignment="leading" spacing={2} modifiers={[padding({ all: 14 })]}>
        <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle('secondary')]}>REST</Text>
        {timer(34)}
        <Text modifiers={[font({ size: 13, weight: 'regular' }), foregroundStyle('secondary')]}>
          {props.label}
        </Text>
      </VStack>
    ),
    compactLeading: <Text modifiers={[font({ size: 12, weight: 'semibold' })]}>Rest</Text>,
    compactTrailing: timer(14),
    minimal: timer(11),
    expandedLeading: <Text modifiers={[font({ size: 14, weight: 'semibold' })]}>Rest</Text>,
    expandedTrailing: timer(22),
    expandedBottom: (
      <Text modifiers={[font({ size: 13, weight: 'regular' }), foregroundStyle('secondary')]}>
        {props.label}
      </Text>
    ),
  };
}

export const nextWorkoutWidget = createWidget<NextWorkoutProps>('NextWorkout', nextWorkoutLayout);
export const restActivity = createLiveActivity<RestProps>('RestTimer', restLayout);
