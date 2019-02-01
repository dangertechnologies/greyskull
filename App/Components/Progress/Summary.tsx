import React from 'react';
import Swiper from 'react-native-swiper';
import { ExerciseDefinitions } from '../../Configuration';
import Progress from './Progress';

interface ISummaryProps<T = keyof typeof ExerciseDefinitions> {
  exerciseNames: T[];
}

class Summary extends React.PureComponent<ISummaryProps> {
  public render(): JSX.Element {
    return (
      <Swiper showsButtons showsPagination>
        {this.props.exerciseNames.map(name => (
          <Progress exerciseName={name} />
        ))}
      </Swiper>
    );
  }
}

export default Summary;
