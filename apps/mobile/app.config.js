// Adds values that must not live in app.json. The Google Maps key is needed
// by real Android builds (Expo Go supplies its own) and comes from the EAS
// environment, so it never enters the repository.
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    config: {
      ...config.android?.config,
      googleMaps: { apiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY },
    },
  },
});
