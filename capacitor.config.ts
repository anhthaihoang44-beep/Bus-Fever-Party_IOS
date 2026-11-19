import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.busfever.partyloop',
  appName: 'Bus Fever Party',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  android: {
    backgroundColor: '#36598f',
  },
  ios: {
    backgroundColor: '#36598f',
    contentInset: 'never',
    allowsLinkPreview: false,
    scrollEnabled: false,
  },
  plugins: {
    SystemBars: {
      insetsHandling: 'disable',
      hidden: true,
    },
  },
};

export default config;
