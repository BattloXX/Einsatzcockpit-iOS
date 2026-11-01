import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'cloud.einsatzleiter.app',
  appName: 'Einsatzcockpit',
  // www/index.html dient als Launcher und leitet zur Remote-PWA weiter.
  webDir: 'www',
  server: {
    allowNavigation: [
      'einsatzcockpit.com',
      '*.einsatzcockpit.com',
    ],
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
  ios: {
    // Service Worker (Offline-Cache der PWA) laufen in WKWebView nur für
    // App-Bound Domains, siehe WKAppBoundDomains in ios/App/App/Info.plist.
    limitsNavigationsToAppBoundDomains: true,
    contentInset: 'never',
  },
};

export default config;
