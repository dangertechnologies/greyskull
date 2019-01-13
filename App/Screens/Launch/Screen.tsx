import { get } from 'lodash';
import React from 'react';
import { StyleSheet } from 'react-native';

import { NavigationScreenProps, NavigationState } from 'react-navigation';
import { compose } from 'recompose';

import Layout from '../../Components/Layout/Layout';
import Title from '../../Components/Layout/Title';
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
      <Layout
        image={Backgrounds['woman-with-barbell']}
        containerStyle={{ alignItems: 'center', justifyContent: 'center' }}
      >
        <Title
          title="Greyskull LP"
          subtitle="8 week program"
          containerStyle={{ marginTop: -100 }}
        />
      </Layout>
    );
  }
}

const styles = StyleSheet.create({});

export default compose<IScreenProps, IScreenProps>(withApplicationState)(Screen);
