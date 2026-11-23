import * as WebBrowser from 'expo-web-browser';
import { Alert } from 'react-native';
import { openLink } from './openLink';

jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn(() => Promise.resolve()) }));

const open = WebBrowser.openBrowserAsync as jest.Mock;
let alert: jest.SpyInstance;
beforeEach(() => {
  open.mockClear();
  alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});
afterEach(() => alert.mockRestore());

test('a web address opens in the in-app browser', async () => {
  await openLink(' https://example.com/squat ');
  expect(open).toHaveBeenCalledWith('https://example.com/squat');
  expect(alert).not.toHaveBeenCalled();
});

test('anything that is not an http(s) address never reaches the browser', async () => {
  for (const href of [
    'javascript:alert(1)',
    'file:///etc/passwd',
    'data:text/html,x',
    'intent://x',
    '',
    undefined,
  ])
    await openLink(href);
  expect(open).not.toHaveBeenCalled();
  expect(alert).toHaveBeenCalledTimes(6);
});

test('a browser that fails, or throws at once, shows the alert instead of throwing', async () => {
  open.mockImplementationOnce(() => Promise.reject(new Error('no browser')));
  await expect(openLink('https://example.com')).resolves.toBeUndefined();
  open.mockImplementationOnce(() => {
    throw new Error('no module');
  });
  await expect(openLink('https://example.com')).resolves.toBeUndefined();
  expect(alert).toHaveBeenCalledTimes(2);
});
