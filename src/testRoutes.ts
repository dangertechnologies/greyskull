/** The real route modules, mounted in expo-router's in-memory test router. */
export const routes = () => ({
  _layout: require('../app/_layout'),
  index: require('../app/index'),
  settings: require('../app/settings'),
  'setup/_layout': require('../app/setup/_layout'),
  'setup/index': require('../app/setup/index'),
  'setup/units': require('../app/setup/units'),
  'setup/template': require('../app/setup/template'),
  'setup/options': require('../app/setup/options'),
  'setup/days': require('../app/setup/days'),
  'setup/weights': require('../app/setup/weights'),
  'setup/summary': require('../app/setup/summary'),
  'setup/confirm': require('../app/setup/confirm'),
  'lift/[id]': require('../app/lift/[id]'),
  'session/[n]': require('../app/session/[n]'),
});
