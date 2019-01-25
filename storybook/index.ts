import { AppRegistry } from 'react-native';
import { getStorybookUI, configure } from '@storybook/react-native';

import './Addons';

// import stories
configure(() => {
  require('./Stories');
}, module);

// Refer to https://github.com/storybooks/storybook/tree/master/app/react-native#start-command-parameters
// To find allowed options for getStorybookUI
const StorybookUIRoot = getStorybookUI({ port: 7007, onDeviceUI: true });

// If you are using React Native vanilla write your app name here.
// If you use Expo you can safely remove this line.
// AppRegistry.registerComponent('Greyskull', () => StorybookUIRoot);

export default StorybookUIRoot;
