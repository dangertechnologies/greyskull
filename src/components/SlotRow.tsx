import { type ReactNode, useRef, useState } from 'react';
import { Animated, View } from 'react-native';
import { useTheme } from '../design/theme';
import { DragHandle } from './DragHandle';

/** One exercise row in the day editor: follows the finger while its grip is dragged, then reports the drop. */
export function SlotRow({
  index,
  count,
  handleLabel,
  onDrop,
  children,
}: {
  index: number;
  count: number;
  handleLabel: string;
  onDrop(to: number): void;
  children: ReactNode;
}) {
  const t = useTheme();
  const offset = useRef(new Animated.Value(0)).current;
  const [height, setHeight] = useState(0);
  const [dragging, setDragging] = useState(false);
  // The parent Card spaces rows by space[5].
  const pitch = height + t.space[5];
  return (
    <Animated.View
      onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
      style={{
        gap: t.space[3],
        zIndex: dragging ? 10 : 0,
        transform: [{ translateY: offset }],
        opacity: dragging ? 0.92 : 1,
      }}
    >
      {children}
      <View style={{ position: 'absolute', top: -2, right: -t.space[2] }}>
        <DragHandle
          index={index}
          count={count}
          rowPitch={pitch}
          label={handleLabel}
          offset={offset}
          onDragStart={() => setDragging(true)}
          onDrop={(to) => {
            setDragging(false);
            onDrop(to);
          }}
        />
      </View>
    </Animated.View>
  );
}
