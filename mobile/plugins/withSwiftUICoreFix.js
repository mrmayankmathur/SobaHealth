const { withXcodeProject } = require('@expo/config-plugins');

const withSwiftUICoreFix = (config) => {
  return withXcodeProject(config, async (config) => {
    const xcodeProject = config.modResults;
    const configurations = xcodeProject.pbxXCBuildConfigurationSection();
    
    for (const key in configurations) {
      const buildConfig = configurations[key];
      if (typeof buildConfig === 'object' && buildConfig.buildSettings) {
        // Fix dead code stripping
        buildConfig.buildSettings['DEAD_CODE_STRIPPING'] = '"YES"';

        // Removed SwiftUICore linking as it causes direct linking error in Xcode 16.
      }
    }
    return config;
  });
};

module.exports = withSwiftUICoreFix;
