import memoize from 'memoize-one';
import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { View } from 'react-native-animatable';

type TInferProps<T> = T extends React.ComponentType<infer P> ? P : {};

interface IGridProps extends TInferProps<typeof View> {
  size?: number;
  children?: React.ReactNode;
  row?: boolean;
  column?: boolean;
  horizontal?: 'center' | 'left' | 'right';
  vertical?: 'center' | 'top' | 'bottom';
  onPress?(): any;
}

const verticalAlignment = memoize(
  ({ isColumn, vertical }: { isColumn: boolean } & Pick<IGridProps, 'vertical'>) => {
    switch (vertical) {
      case 'center':
        return isColumn ? styles.columnAlignCenterVertical : styles.rowAlignCenterVertical;
      case 'top':
        return isColumn ? styles.columnAlignTop : styles.rowAlignTop;
      case 'bottom':
        return isColumn ? styles.columnAlignBottom : styles.rowAlignBottom;
      default:
        return isColumn ? styles.columnAlignTop : styles.rowAlignTop;
    }
  }
);

const horizontalAlignment = memoize(
  ({ isColumn, horizontal }: { isColumn: boolean } & Pick<IGridProps, 'horizontal'>) => {
    switch (horizontal) {
      case 'center':
        return isColumn ? styles.columnAlignCenterHorizontal : styles.rowAlignCenterHorizontal;
      case 'right':
        return isColumn ? styles.columnAlignRight : styles.rowAlignRight;
      case 'left':
        return isColumn ? styles.columnAlignLeft : styles.rowAlignLeft;
      default:
        return isColumn ? styles.columnAlignLeft : styles.rowAlignLeft;
    }
  }
);

const styles = StyleSheet.create({
  columnAlignBottom: {
    justifyContent: 'flex-end',
  },

  columnAlignCenterHorizontal: {
    alignItems: 'center',
  },

  columnAlignCenterVertical: {
    justifyContent: 'center',
  },
  columnAlignLeft: {
    alignItems: 'flex-start',
  },

  columnAlignTop: {
    justifyContent: 'flex-start',
  },

  columnAlignRight: {
    alignItems: 'flex-end',
  },

  column: {
    flexDirection: 'column',
  },

  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },

  rowAlignBottom: {
    alignItems: 'flex-end',
  },
  rowAlignTop: {
    alignItems: 'flex-start',
  },

  rowAlignCenterHorizontal: {
    justifyContent: 'center',
  },

  rowAlignCenterVertical: {
    alignItems: 'center',
  },

  rowAlignLeft: {
    justifyContent: 'flex-start',
  },

  rowAlignRight: {
    justifyContent: 'flex-end',
  },
});

const Grid = ({
  size,
  row,
  vertical,
  horizontal,
  column,
  children,
  onPress,
  ...rest
}: IGridProps) => {
  const isColumn = !row;
  const Component: React.ComponentType<any> = onPress ? TouchableOpacity : View;

  return (
    <Component
      {...rest}
      onPress={onPress}
      style={[
        isColumn ? styles.column : styles.row,
        verticalAlignment({ isColumn, vertical }),
        horizontalAlignment({ isColumn, horizontal }),
        rest.style || {},
        { flex: (size || 12) / 12 },
      ]}
    >
      {children}
    </Component>
  );
};

export default Grid;
