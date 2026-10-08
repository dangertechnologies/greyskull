import { TextInput, type TextInputProps, View } from 'react-native';
import { useTheme } from '../design/theme';
import { Text } from './Text';

/** Labelled text input: 56 tall (multiline 112), outline in `borderStrong`, label above with 8 of space. */
export function TextField({ label, multiline, style, ...rest }: TextInputProps & { label: string }) {
  const t = useTheme();
  return (
    <View style={{ gap: t.space[2] }}>
      <Text variant="label" color="textMuted">
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        multiline={multiline}
        placeholderTextColor={t.color.textMuted}
        maxFontSizeMultiplier={1.6}
        style={[
          t.type.body,
          {
            minHeight: multiline ? 112 : 56,
            color: t.color.text,
            backgroundColor: t.color.surface,
            borderRadius: t.radius.md,
            borderWidth: 1,
            borderColor: t.color.borderStrong,
            paddingHorizontal: t.space[4],
            paddingTop: multiline ? t.space[3] : 0,
            textAlignVertical: multiline ? 'top' : 'center',
          },
          style,
        ]}
        {...rest}
      />
    </View>
  );
}
