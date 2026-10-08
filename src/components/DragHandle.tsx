import { useRef } from 'react';
import { type Animated, PanResponder, View } from 'react-native';
import { haptics } from '../design/haptics';
import { dragTarget } from '../domain';
import { Icon } from '../ui/Icon';

interface Props {
  index: number;
  count: number;
  /** Height of one row plus the gap between rows. */
  rowPitch: number;
  label: string;
  /** Row currently following the finger; the parent lifts it above its siblings. */
  offset: Animated.Value;
  onDragStart?(): void;
  onDrop(to: number): void;
}

/** Grip that drags its row up or down; the up/down buttons stay as the accessible alternative. */
export function DragHandle({ index, count, rowPitch, label, offset, onDragStart, onDrop }: Props) {
  const live = useRef({ index, count, rowPitch, onDrop, onDragStart });
  live.current = { index, count, rowPitch, onDrop, onDragStart };
  const last = useRef(index);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        last.current = live.current.index;
        live.current.onDragStart?.();
        haptics.tick();
      },
      onPanResponderMove: (_e, g) => {
        offset.setValue(g.dy);
        const { index: i, count: c, rowPitch: p } = live.current;
        const target = dragTarget(i, g.dy, p, c);
        if (target !== last.current) {
          last.current = target;
          haptics.tick();
        }
      },
      onPanResponderRelease: (_e, g) => {
        const { index: i, count: c, rowPitch: p, onDrop: drop } = live.current;
        offset.setValue(0);
        drop(dragTarget(i, g.dy, p, c));
      },
      onPanResponderTerminate: () => offset.setValue(0),
    }),
  ).current;

  return (
    <View
      {...pan.panHandlers}
      accessible
      accessibilityLabel={label}
      accessibilityHint="Drag to reorder. Use Move up and Move down for the same thing."
      style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: 0.9 }}
    >
      <Icon name="grip" size={20} color="textMuted" />
    </View>
  );
}
