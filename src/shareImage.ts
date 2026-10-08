import * as Sharing from 'expo-sharing';
import type { RefObject } from 'react';
import type { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

/** Render `ref` to a PNG and open the system share sheet. Resolves false when sharing is unavailable. */
export async function shareView(ref: RefObject<View | null>): Promise<boolean> {
  if (!(await Sharing.isAvailableAsync())) return false;
  const uri = await captureRef(ref, { format: 'png', quality: 1, result: 'tmpfile' });
  await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share workout' });
  return true;
}
