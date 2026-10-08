import { monogramOf } from '../monogram';

test('catalog abbreviations win, capped at 3 letters and upper-cased', () => {
  expect(monogramOf({ name: 'Squat', abbr: 'sq' })).toBe('SQ');
  expect(monogramOf({ name: 'Anything', abbr: 'abcdef' })).toBe('ABC');
});

test('derives from the name when there is no abbreviation', () => {
  expect(monogramOf({ name: 'Front squat' })).toBe('FS');
  expect(monogramOf({ name: 'Close grip bench press' })).toBe('CGB');
  expect(monogramOf({ name: 'Deadlift' })).toBe('DEA');
  expect(monogramOf({ name: '  ' })).toBe('?');
});
