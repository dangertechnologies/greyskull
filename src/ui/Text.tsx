import { Text as RNText, type TextProps } from 'react-native';
import { useTheme } from '../design/theme';
import { type ColorRole, maxFontScale, type TypeVariant } from '../design/tokens';

export interface Props extends TextProps {
  variant?: TypeVariant;
  color?: ColorRole;
  align?: 'left' | 'center' | 'right';
}

/** The only text component screens should use: type scale and colour roles come from the theme. */
export function Text({ variant = 'body', color = 'text', align, style, ...rest }: Props) {
  const theme = useTheme();
  return (
    <RNText
      maxFontSizeMultiplier={maxFontScale[variant]}
      style={[theme.type[variant], { color: theme.color[color] }, align && { textAlign: align }, style]}
      {...rest}
    />
  );
}
