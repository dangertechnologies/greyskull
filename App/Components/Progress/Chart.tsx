import { format } from 'date-fns';
import { first, last, round } from 'lodash';
import React from 'react';
import { LayoutChangeEvent, StyleSheet } from 'react-native';
import { Circle, G, Line, Text as SVGText } from 'react-native-svg';
import { AreaChart, Grid as ChartGrid, XAxis, YAxis } from 'react-native-svg-charts';

import { compose } from 'recompose';

import { IExercise, withApplicationState } from '../../Store';
import { Grid } from '../Layout';

interface IChartProps {
  exercises: IExercise[];
  height?: number;
  showAnnotations: 'FIRST_LAST_CHART_ONLY' | boolean;
}

interface IChartState {
  chartWidth: number;
}

interface ITooltipProps {
  x?: (datapoint: number) => number;
  y?: (datapoint: number) => number;
  data?: any;
  disableLabels: boolean;
}

const Tooltip = ({ x, y, data, disableLabels }: ITooltipProps) => {
  if (!x || !y || !data) {
    return null;
  }
  const dataset = disableLabels ? [first(data), last(data)] : data;

  return dataset.map((point: IExercise, idx: number) => {
    if (!point.completed) {
      return null;
    }
    const posX = x(point.completed) < 10 ? 10 : x(point.completed);

    return (
      <G key={idx} x={idx === dataset.length - 1 ? posX - 15 : posX} y={y(point.weight) - 3}>
        {!disableLabels && (
          <SVGText
            x={posX >= 200 ? -5 : 20}
            y={-20}
            alignmentBaseline={'middle'}
            textAnchor={'end'}
            stroke={'white'}
            fontSize={10}
          >
            {`${round(point.weight, 1)}kg`}
          </SVGText>
        )}

        <Line y1={0} y2={200 - y(point.weight)} stroke={'grey'} strokeWidth={0.5} />
        <Circle cy={0} r={3} stroke={'#FFFFFF'} strokeWidth={1} fill={'black'} />
      </G>
    );
  });
};
class Chart extends React.Component<IChartProps, IChartState> {
  public static defaultProps = {
    showAnnotations: true,
  };

  public state: IChartState = {
    chartWidth: 0,
  };

  public setChartWidth = (e: LayoutChangeEvent) => {
    this.setState({
      chartWidth: e.nativeEvent.layout.width - 26,
    });
  };

  public render(): JSX.Element {
    const { exercises } = this.props;

    const height = this.props.height || 20;
    return (
      <Grid
        style={{ width: '100%', height: this.props.height || 200 }}
        onLayout={this.setChartWidth}
      >
        {!this.state.chartWidth ? null : (
          <>
            {this.props.showAnnotations === true && (
              <YAxis
                data={exercises}
                svg={{
                  fill: '#FFFFFF',
                  fontSize: 11,
                }}
                min={0}
                numberOfTicks={4}
                formatLabel={value => value}
                style={styles.yaxis}
                yAccessor={({ item }) => item.weight}
                contentInset={{ top: 20, bottom: 5 }}
              />
            )}
            <AreaChart
              data={exercises}
              yAccessor={({ item }) => item.weight}
              xAccessor={({ item }) => item.completed as number}
              contentInset={{ top: height * 0.15, left: -2, right: -2 }}
              gridMin={5}
              style={{
                height,
                marginLeft: this.props.showAnnotations ? 16 : 0,
                width: this.state.chartWidth,
              }}
              svg={{
                fill: '#FFFFFF',
                fillOpacity: 0.1,
                stroke: '#FFFFFF',
                strokeWidth: 1,
              }}
            >
              {this.props.showAnnotations && (
                <Tooltip disableLabels={this.props.showAnnotations === 'FIRST_LAST_CHART_ONLY'} />
              )}
              <ChartGrid />
            </AreaChart>
            {this.props.showAnnotations === true && (
              <XAxis
                data={exercises}
                svg={{
                  fill: '#FFFFFF',
                  fontSize: 12,
                }}
                numberOfTicks={4}
                formatLabel={value => format(value, 'DD/MM')}
                style={{ marginTop: 5, marginLeft: 5, width: this.state.chartWidth }}
                xAccessor={({ item }) => item.completed}
                contentInset={{ left: 26, right: 10 }}
              />
            )}

            {this.props.showAnnotations === 'FIRST_LAST_CHART_ONLY' && (
              <XAxis
                data={exercises}
                svg={{
                  fill: '#FFFFFF',
                  fontSize: 10,
                }}
                formatLabel={(_, i) =>
                  Boolean(i === 0 || i === exercises.length - 1)
                    ? `${round(exercises[i].weight, 1)}kg`
                    : null
                }
                style={{ width: this.state.chartWidth + 26 }}
                xAccessor={({ item }) => item.completed}
                contentInset={{ left: 26, right: 14 }}
              />
            )}
          </>
        )}
      </Grid>
    );
  }
}

const styles = StyleSheet.create({
  bodyText: { color: 'white', fontSize: 20, fontWeight: '100' },
  smallText: { color: 'white', fontSize: 12, fontWeight: '100' },
  yaxis: { position: 'absolute', height: 200, left: 0 },
});

export default compose<IChartProps, IChartProps>(withApplicationState)(Chart);
