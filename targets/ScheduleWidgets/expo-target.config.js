/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: 'widget',
  name: 'ScheduleWidgets',
  displayName: 'Music Ministry',
  bundleIdentifier: '.ScheduleWidgets',
  deploymentTarget: '16.0',
  exportJs: false,
  colors: {
    $accent: '#69C6FF',
    $widgetBackground: '#06152F',
  },
  entitlements: {
    'com.apple.security.application-groups': [
      'group.com.lbkchano.musicministry.widgets',
    ],
  },
};
