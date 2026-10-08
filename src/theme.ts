import { StyleSheet } from 'react-native';

export const colors = {
  text: '#ffffff',
  dim: 'rgba(255,255,255,0.62)',
  faint: 'rgba(255,255,255,0.14)',
  card: 'rgba(0,0,0,0.38)',
  overlay: 'rgba(0,0,0,0.45)',
  border: '#ffffff',
  danger: '#ff6b6b',
  good: '#7ee0a1',
  bg: '#000000',
};

/** Thin, white typography shared by all screens. */
export const type = StyleSheet.create({
  title: { color: colors.text, fontSize: 28, fontWeight: '200' },
  heading: { color: colors.text, fontSize: 20, fontWeight: '300' },
  body: { color: colors.text, fontSize: 16, fontWeight: '300' },
  small: { color: colors.dim, fontSize: 13, fontWeight: '300' },
  label: { color: colors.dim, fontSize: 12, fontWeight: '300', letterSpacing: 1, textTransform: 'uppercase' },
  big: { color: colors.text, fontSize: 64, fontWeight: '200' },
  error: { color: colors.danger, fontSize: 13, fontWeight: '300' },
});

export const space = { gutter: 16, gap: 12 };
