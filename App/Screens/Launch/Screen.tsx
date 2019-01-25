import { get } from 'lodash';
import React from 'react';
import { StyleSheet } from 'react-native';

import { NavigationScreenProps, NavigationState } from 'react-navigation';
import { compose } from 'recompose';

import { ScreenLayout, ScreenTitle } from '../../Components/Layout';
import Backgrounds from '../../Images/Backgrounds';
import { IAppState, withApplicationState } from '../../Store';

interface IScreenProps extends NavigationScreenProps<NavigationState>, IAppState {}

class Screen extends React.Component<IScreenProps> {
  public componentDidMount() {
    setTimeout(this.redirect, 2000);
  }

  public redirect = () => {
    if (get(this.props, 'store.configuration.initialSetupComplete')) {
      this.props.navigation.navigate('ScheduleScreen');
    } else {
      this.props.navigation.navigate('ConfigurationScreen');
    }
  };

  public render(): JSX.Element {
    return (
      <ScreenLayout
        image={'woman-with-barbell'}
        containerStyle={{ alignItems: 'center', justifyContent: 'center' }}
      >
        <ScreenTitle
          title="Greyskull LP"
          subtitle="8 week program"
          containerStyle={{ marginTop: -100 }}
        />
      </ScreenLayout>
    );
  }
}

export default compose<IScreenProps, IScreenProps>(withApplicationState)(Screen);
