import type { ConfigContext, ExpoConfig } from 'expo/config';
import pkg from './package.json';

/**
 * Static fields live in app.json. This file adds what must not be duplicated or hard-coded:
 * - `version` comes from package.json, the single source of truth (bumped by the Release workflow);
 * - OTA updates are tied to the native code with `runtimeVersion.policy = fingerprint`: a JS-only release
 *   reaches every installed binary with the same native fingerprint, while a change to native dependencies
 *   or config only reaches binaries built after it (version numbers are excluded from the fingerprint);
 * - the EAS project id is read from the environment (`EAS_PROJECT_ID`, set in CI and locally after
 *   `eas init`), so no account-specific id is committed.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const projectId = process.env.EAS_PROJECT_ID;
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
