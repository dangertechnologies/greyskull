import type { SymbolViewProps } from 'expo-symbols';

type SymbolName = Extract<SymbolViewProps['name'], object>;

/** Closed set of UI icons; SF Symbols on iOS, Material Symbols elsewhere (all names verified to exist). */
export const ICON_NAMES = {
  today: { ios: 'house', android: 'home' },
  progress: { ios: 'chart.line.uptrend.xyaxis', android: 'show_chart' },
  plan: { ios: 'list.bullet', android: 'list' },
  settings: { ios: 'gearshape', android: 'settings' },
  back: { ios: 'chevron.left', android: 'arrow_back' },
  close: { ios: 'xmark', android: 'close' },
  up: { ios: 'chevron.up', android: 'keyboard_arrow_up' },
  down: { ios: 'chevron.down', android: 'keyboard_arrow_down' },
  chevron: { ios: 'chevron.right', android: 'chevron_right' },
  add: { ios: 'plus', android: 'add' },
  remove: { ios: 'minus', android: 'remove' },
  check: { ios: 'checkmark', android: 'check' },
  do: { ios: 'checkmark.circle', android: 'check_circle' },
  dont: { ios: 'xmark.circle', android: 'cancel' },
  timer: { ios: 'timer', android: 'timer' },
  lift: { ios: 'dumbbell', android: 'fitness_center' },
  calendar: { ios: 'calendar', android: 'calendar_today' },
  delete: { ios: 'trash', android: 'delete' },
  edit: { ios: 'pencil', android: 'edit' },
  skip: { ios: 'forward.end', android: 'skip_next' },
  undo: { ios: 'arrow.uturn.backward', android: 'undo' },
  video: { ios: 'play.circle', android: 'play_circle' },
  guide: { ios: 'book', android: 'menu_book' },
  rules: { ios: 'slider.horizontal.3', android: 'tune' },
  share: { ios: 'square.and.arrow.up', android: 'share' },
} as const satisfies Record<string, SymbolName>;

export type IconName = keyof typeof ICON_NAMES;
