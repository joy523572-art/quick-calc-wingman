import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.p68613b03b3b64425a13b90166423a9fb',
  appName: 'quick-calc-wingman',
  webDir: 'dist',
  android: {
    // Keep the WebView lean: no debug bridge, no extra web contents debugging in release
    webContentsDebuggingEnabled: false,
    allowMixedContent: false,
  },
  // For local hot-reload development only, uncomment the block below.
  // It MUST stay disabled for Play Store release builds.
  // server: {
  //   url: 'https://68613b03-b3b6-4425-a13b-90166423a9fb.lovableproject.com?forceHideBadge=true',
  //   cleartext: true,
  // },
};

export default config;
