const { createRunOncePlugin, withGradleProperties } = require("expo/config-plugins");

const PLUGIN_NAME = "with-android-kotlin-ksp";
const PLUGIN_VERSION = "1.0.0";
const KOTLIN_VERSION = "2.1.20";
const KSP_VERSION = "2.1.20-2.0.1";

function setGradleProperty(properties, key, value) {
  const existing = properties.find((item) => item.type === "property" && item.key === key);
  if (existing) {
    existing.value = value;
    return properties;
  }
  properties.push({ type: "property", key, value });
  return properties;
}

function withAndroidKotlinKsp(config) {
  return withGradleProperties(config, (modConfig) => {
    setGradleProperty(modConfig.modResults, "kotlinVersion", KOTLIN_VERSION);
    setGradleProperty(modConfig.modResults, "kspVersion", KSP_VERSION);
    setGradleProperty(modConfig.modResults, "AsyncStorage_next_kspVersion", KSP_VERSION);
    return modConfig;
  });
}

module.exports = createRunOncePlugin(
  withAndroidKotlinKsp,
  PLUGIN_NAME,
  PLUGIN_VERSION
);
