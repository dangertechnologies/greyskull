import { View } from 'react-native';
import { useTheme } from '../design/theme';
import { Button } from './Button';
import { Icon } from './Icon';
import type { IconName } from './icons';
import { Text } from './Text';

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: IconName;
  title: string;
  body?: string;
  action?: { title: string; onPress(): void };
}) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: t.space[3], paddingVertical: t.space[8] }}>
      <Icon name={icon} size={40} color="textMuted" />
      <Text variant="headline" align="center">
        {title}
      </Text>
      {body ? (
        <Text color="textMuted" align="center">
          {body}
        </Text>
      ) : null}
      {action ? <Button title={action.title} variant="secondary" onPress={action.onPress} /> : null}
    </View>
  );
}
