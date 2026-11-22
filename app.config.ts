import type { ConfigContext, ExpoConfig } from 'expo/config';
import pkg from './package.json';

/**
 * Static fields live in app.json. This file adds what must not be duplicated or hard-coded:
 * - `version` comes from package.json, the single source of truth (bumped by the Release workflow);
 * - OTA updates are tied to the native code with `runtimeVersion.policy = fingerprint`: a JS-only release
 *   reaches every installed binary with the same native fingerprint, while a change to native dependencies
 *   or config only reaches binaries built after it (version numbers are excluded from the fingerprint);
 * - the EAS project id is read from the environment (`EAS_PROJECT_ID`, set in CI), falling back to the
 *   `extra.eas.projectId` that `eas init` writes to app.json. EAS builds without either fail, because the
 *   binary could never receive an OTA update.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const projectId = process.env.EAS_PROJECT_ID ?? config.extra?.eas?.projectId;
  if (process.env.EAS_BUILD && !projectId) {
    throw new Error('EAS_PROJECT_ID is not set: this build could never receive OTA updates.');
  }
  return {
    ...config,
    name: config.name ?? 'Greyskull LP',
    slug: config.slug ?? 'greyskull',
    version: pkg.version,
    runtimeVersion: { policy: 'fingerprint' },
    ...(projectId
      ? {
          updates: { url: `https://u.expo.dev/${projectId}` },
          extra: { ...config.extra, eas: { projectId } },
        }
      : {}),
  };
};
