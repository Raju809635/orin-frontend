/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function ok(msg) {
  console.log(`[OK] ${msg}`);
}

function warn(msg) {
  console.log(`[WARN] ${msg}`);
}

function fail(msg) {
  console.error(`[FAIL] ${msg}`);
}

function exists(filePath) {
  return fs.existsSync(filePath);
}

function run() {
  const root = path.resolve(__dirname, "..");
  const appJsonPath = path.join(root, "app.json");
  const easJsonPath = path.join(root, "eas.json");
  const privacyPath = path.join(root, "app", "privacy.tsx");
  const termsPath = path.join(root, "app", "terms.tsx");
  const helpPath = path.join(root, "app", "help.tsx");

  let hasError = false;

  if (!exists(appJsonPath)) {
    fail("Missing app.json");
    process.exit(1);
  }

  if (!exists(easJsonPath)) {
    fail("Missing eas.json");
    process.exit(1);
  }

  const appJson = readJson(appJsonPath);
  const easJson = readJson(easJsonPath);
  const expo = appJson.expo || {};
  const android = expo.android || {};
  const production = easJson.build?.production || {};
  const productionEnv = production.env || {};
  const apiBase = productionEnv.EXPO_PUBLIC_API_BASE_URL || "";

  if (expo.name && expo.slug && expo.version) ok("Basic Expo identity fields present");
  else {
    hasError = true;
    fail("expo.name / expo.slug / expo.version must be set");
  }

  if (android.package) ok(`Android package set: ${android.package}`);
  else {
    hasError = true;
    fail("expo.android.package is required");
  }

  if (typeof android.versionCode === "number" && android.versionCode > 0) {
    ok(`Android versionCode set: ${android.versionCode}`);
  } else {
    hasError = true;
    fail("expo.android.versionCode must be a number > 0");
  }

  if (production.android?.buildType === "app-bundle") ok("Production build uses AAB (app-bundle)");
  else {
    hasError = true;
    fail("eas build.production.android.buildType must be 'app-bundle'");
  }

  if (apiBase.startsWith("https://")) ok("Production API base URL uses HTTPS");
  else {
    hasError = true;
    fail("Production EXPO_PUBLIC_API_BASE_URL must use HTTPS");
  }

  if (expo.runtimeVersion?.policy) ok(`Runtime policy set: ${expo.runtimeVersion.policy}`);
  else warn("runtimeVersion policy missing (recommended for OTA reliability)");

  if (exists(privacyPath)) ok("In-app Privacy page exists");
  else warn("Missing in-app privacy page (recommended)");

  if (exists(termsPath)) ok("In-app Terms page exists");
  else warn("Missing in-app terms page (recommended)");

  if (exists(helpPath)) ok("In-app Help page exists");
  else warn("Missing in-app help page (recommended)");

  if (hasError) {
    fail("Play Store preflight failed. Fix FAIL items before submission.");
    process.exit(1);
  }

  ok("Play Store preflight passed.");
}

run();
