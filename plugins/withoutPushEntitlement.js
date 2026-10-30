// iOS: expo-notifications adds the aps-environment (Push Notifications) entitlement. The app only
// schedules local daily reminders and never asks for a push token, so the entitlement is not needed.
// Dropping it keeps the provisioning profile free of the Push Notifications capability (which needs
// a developer portal sign-in to enable). Add push again later by removing this plugin.
const { withEntitlementsPlist } = require('expo/config-plugins');

module.exports = function withoutPushEntitlement(config) {
  return withEntitlementsPlist(config, (cfg) => {
    delete cfg.modResults['aps-environment'];
    return cfg;
  });
};
