import * as WebBrowser from 'expo-web-browser';
import { Alert } from 'react-native';
import { linkProblem } from './exerciseEdit';

const couldNotOpen = () =>
  Alert.alert(
    'Could not open the link',
    'Check that the link is a web address and that this device has a browser.',
  );

/**
 * Open an exercise link in the in-app browser. Only http(s) addresses open: a custom exercise from a backup, a
 * shared plan or an older version may hold any text (`file:`, `data:`, `intent:`). Anything else, or a browser
 * that fails to open, shows an alert instead. Never throws.
 */
export async function openLink(href: string | undefined): Promise<void> {
  try {
    if (typeof href !== 'string' || !href.trim() || linkProblem(href) !== null) return couldNotOpen();
    await WebBrowser.openBrowserAsync(href.trim());
  } catch {
    couldNotOpen();
  }
}
