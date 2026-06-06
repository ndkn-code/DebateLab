const googleIosUrlScheme = process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME;

const plugins = [
  "expo-router",
  [
    "expo-splash-screen",
    {
      backgroundColor: "#00B8D9",
      android: {
        image: "./assets/images/splash-icon.png",
        imageWidth: 76,
      },
    },
  ],
  "expo-secure-store",
  "expo-apple-authentication",
  [
    "expo-audio",
    {
      microphonePermission:
        "Allow Thinkfy to record your practice speech so it can be prepared for transcription and feedback.",
      enableBackgroundPlayback: false,
      enableBackgroundRecording: false,
    },
  ],
];

if (googleIosUrlScheme) {
  plugins.push([
    "@react-native-google-signin/google-signin",
    {
      iosUrlScheme: googleIosUrlScheme,
    },
  ]);
}

module.exports = {
  expo: {
    name: "Thinkfy",
    slug: "thinkfy",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "thinkfy",
    userInterfaceStyle: "automatic",
    ios: {
      bundleIdentifier: "net.thinkfy.app",
      icon: "./assets/expo.icon",
      supportsTablet: true,
      usesAppleSignIn: true,
    },
    android: {
      adaptiveIcon: {
        backgroundColor: "#F3FCFE",
        foregroundImage: "./assets/images/android-icon-foreground.png",
        backgroundImage: "./assets/images/android-icon-background.png",
        monochromeImage: "./assets/images/android-icon-monochrome.png",
      },
      predictiveBackGestureEnabled: false,
    },
    web: {
      output: "static",
      favicon: "./assets/images/favicon.png",
    },
    plugins,
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
  },
};
