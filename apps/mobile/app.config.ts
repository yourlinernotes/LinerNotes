import { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'LinerNotes',
  slug: 'linernotes',
  version: '0.2.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'dark',
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.anusha.linernotes',
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
    scheme: 'com.googleusercontent.apps.985992092131-ag9ohcq8t4d7dde659kqq343q5m6af47',
  },
  android: {
    package: 'com.anusha.linernotes',
    adaptiveIcon: {
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
      backgroundColor: '#0A0A0A',
    },
    // Custom-URI-scheme redirect for Google Sign-In. expo-auth-session's Google
    // provider redirects to `${applicationId}:/oauthredirect`, so the scheme is
    // the package name.
    intentFilters: [
      {
        action: 'VIEW',
        category: ['DEFAULT', 'BROWSABLE'],
        data: [{ scheme: 'com.anusha.linernotes' }],
      },
    ],
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-font',
    [
      'expo-dev-client',
      {
        addGeneratedScheme: false,
      },
    ],
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        resizeMode: 'contain',
        backgroundColor: '#0A0A0A',
      },
    ],
    // TODO: Re-enable push notifications after updating provisioning profile
    // [
    //   'expo-notifications',
    //   {
    //     icon: './assets/notification-icon.png',
    //     color: '#d9b25a',
    //   },
    // ],
  ],
  extra: {
    eas: {
      projectId: '9b3785c0-ecf9-4932-8ebc-7bceaf551ff9',
    },
  },
  owner: 'linernotes',
};

export default config;
