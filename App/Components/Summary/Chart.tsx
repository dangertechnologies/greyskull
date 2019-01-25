import { format } from 'date-fns';
import { round } from 'lodash';
import React from 'react';
import { LayoutChangeEvent, StyleSheet } from 'react-native';
import { Circle, G, Line, Text as SVGText } from 'react-native-svg';
import { AreaChart, Grid as ChartGrid, XAxis, YAxis } from 'react-native-svg-charts';

import { compose } from 'recompose';

import { IExercise, withApplicationState } from '../../Store';
import { Grid } from '../Layout';

interface IChartProps {
  exercises: IExercise[];
}

interface IChartState {
  chartWidth: number;
}

interface ITooltipProps {
  x?: (datapoint: number) => number;
  y?: (datapoint: number) => number;
  data?: any;
}

const Tooltip = ({ x, y, data }: ITooltipProps) =>
  x &&
  y &&
  data &&
  data.map(
    (point: IExercise) =>
      point.completed && (
        <G x={x(point.completed) + 20} y={y(point.weight) - 3}>
          <SVGText
            x={20}
            y={-20}
            alignmentBaseline={'middle'}
            textAnchor={'end'}
            stroke={'white'}
            fontSize={10}
          >
            {`${round(point.weight, 1)}kg`}
          </SVGText>

          <Line y1={0} y2={200 - y(point.weight)} stroke={'grey'} strokeWidth={0.5} />
          <Circle cy={0} r={3} stroke={'#FFFFFF'} strokeWidth={1} fill={'black'} />
        </G>
      )
  );

class Chart extends React.Component<IChartProps, IChartState> {
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

    return (
      <Grid style={{ width: '100%', height: 200 }} onLayout={this.setChartWidth}>
        {!this.state.chartWidth ? null : (
          <>
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
            <AreaChart
              data={exercises}
              yAccessor={({ item }) => item.weight}
              xAccessor={({ item }) => item.completed as number}
              contentInset={{ top: 30, left: -2, right: -2 }}
              gridMin={5}
              style={{
                height: 200,
                marginLeft: 16,
                width: this.state.chartWidth,
              }}
              svg={{
                fill: '#FFFFFF',
                fillOpacity: 0.1,
                stroke: '#FFFFFF',
                strokeWidth: 1,
              }}
            >
              <Tooltip />
              <ChartGrid />
            </AreaChart>
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
