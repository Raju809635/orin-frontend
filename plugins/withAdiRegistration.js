const { createRunOncePlugin, withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

const PLUGIN_NAME = "with-adi-registration";
const PLUGIN_VERSION = "1.0.0";
const SOURCE_RELATIVE_PATH = path.join("android-verification", "adi-registration.properties");

function withAdiRegistration(config) {
  if (process.env.ORIN_INCLUDE_ADI_REGISTRATION !== "true") {
    return config;
  }

  return withDangerousMod(config, [
    "android",
    async (modConfig) => {
      const projectRoot = modConfig.modRequest.projectRoot;
      const androidRoot = modConfig.modRequest.platformProjectRoot;
      const sourcePath = path.join(projectRoot, SOURCE_RELATIVE_PATH);
      const assetDir = path.join(androidRoot, "app", "src", "main", "assets");
      const destinationPath = path.join(assetDir, "adi-registration.properties");

      if (!fs.existsSync(sourcePath)) {
        throw new Error(
          `Missing Android verification snippet at ${SOURCE_RELATIVE_PATH}.`
        );
      }

      fs.mkdirSync(assetDir, { recursive: true });
      fs.copyFileSync(sourcePath, destinationPath);

      return modConfig;
    },
  ]);
}

module.exports = createRunOncePlugin(
  withAdiRegistration,
  PLUGIN_NAME,
  PLUGIN_VERSION
);
