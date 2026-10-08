import { fireEvent, render, screen } from '@testing-library/react-native';
import * as WebBrowser from 'expo-web-browser';
import { builtInExercises } from '../catalog';
import { TechniqueLinks } from './TechniqueLinks';

jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn(() => Promise.resolve()) }));

const ex = builtInExercises();

test('opens the technique video and the guide in the in-app browser', () => {
  render(<TechniqueLinks exercise={ex.BARBELL_SQUAT} />);
  fireEvent.press(screen.getByLabelText('Watch technique: Squat'));
  expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(ex.BARBELL_SQUAT.video);
  fireEvent.press(screen.getByLabelText('Read guide: Squat'));
  expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(ex.BARBELL_SQUAT.url);
});

test('compact mode shows only the video; nothing renders without links', () => {
  render(<TechniqueLinks exercise={ex.BARBELL_SQUAT} compact />);
  expect(screen.queryByText('Read guide')).toBeNull();
  const { toJSON } = render(<TechniqueLinks exercise={{ ...ex.CRUNCHES, url: undefined }} />);
  expect(toJSON()).toBeNull();
});
