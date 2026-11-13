import type { CapacitorConfig } from '@capacitor/cli';

// Native shells (P2.1). The web build in `dist` is copied into the Android and iOS projects with `npm run cap:sync`.
// Store ids are placeholders until the owner creates the developer accounts (see docs/NEEDS_FROM_YOU.md).
const config: CapacitorConfig = {
  appId: 'com.junkyardempire.game',
  appName: 'Junkyard Empire',
  webDir: 'dist',
  backgroundColor: '#12161E',
  ios: { contentInset: 'never' },
  android: { allowMixedContent: false },
};

export default config;
