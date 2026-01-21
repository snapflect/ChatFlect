import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.ionic.starter',
  appName: 'SecureChat',
  webDir: 'www',
  server: {
    androidScheme: 'http',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 3000,
      launchAutoHide: true,
      backgroundColor: "#ffffffff",
      androidSplashResourceName: "splash",
      showSpinner: true,
      androidSpinnerStyle: "large",
      spinnerColor: "#999999"
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    },
    BackgroundRunner: {
      label: 'com.chatflect.location.runner',
      src: 'assets/background/location-runner.js',
      event: 'updateLocation',
      repeat: true,
      interval: 15,
      autoStart: false
    }
  }
};

export default config;
