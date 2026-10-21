// Sentry's Metro config gives each bundle a debug ID so crash stack traces can be matched to source maps.
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

module.exports = getSentryExpoConfig(__dirname);
