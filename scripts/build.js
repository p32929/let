#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Read app configuration
const appJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../app.json'), 'utf8'));
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

const APP_NAME = appJson.expo.slug.replace(/\./g, '_'); // Replace dots with underscores for filename
const VERSION = appJson.expo.version;
const BUILD_DIR = path.join(__dirname, '../_build');

// Ensure build directory exists
if (!fs.existsSync(BUILD_DIR)) {
  fs.mkdirSync(BUILD_DIR, { recursive: true });
}

const BUILD_TYPES = {
  'apk': {
    description: 'Android APK (local build)',
    build: buildAPK,
    extension: 'apk'
  },
  'aab': {
    description: 'Android App Bundle (EAS cloud build)',
    build: buildAAB,
    extension: 'aab'
  },
  'ipa': {
    description: 'iOS IPA (EAS cloud build)',
    build: buildIPA,
    extension: 'ipa'
  },
  'web': {
    description: 'Web build (static export)',
    build: buildWeb,
    extension: 'zip'
  }
};

function log(message) {
  console.log(`\n🔨 ${message}\n`);
}

function error(message) {
  console.error(`\n❌ ${message}\n`);
  process.exit(1);
}

function success(message) {
  console.log(`\n✅ ${message}\n`);
}

function exec(command, options = {}) {
  console.log(`   Running: ${command}`);
  try {
    return execSync(command, { stdio: 'inherit', ...options });
  } catch (err) {
    error(`Command failed: ${command}`);
  }
}

function getArchitecture() {
  // Detect build architecture
  const platform = process.platform;
  const arch = process.arch;

  if (platform === 'darwin') {
    return arch === 'arm64' ? 'arm64' : 'x64';
  }
  return arch;
}

function buildAPK() {
  log('Building Android APKs (split by architecture)...');

  // Prebuild if needed
  if (!fs.existsSync(path.join(__dirname, '../android'))) {
    log('Running expo prebuild...');
    exec('npx expo prebuild --platform android');
  }

  // Enable split APKs in build.gradle
  const buildGradlePath = path.join(__dirname, '../android/app/build.gradle');
  let buildGradle = fs.readFileSync(buildGradlePath, 'utf8');

  // Check if split config exists
  if (!buildGradle.includes('splits {')) {
    log('Configuring split APKs in build.gradle...');
    const splitConfig = `
    splits {
        abi {
            enable true
            reset()
            include 'arm64-v8a', 'armeabi-v7a', 'x86', 'x86_64'
            universalApk false
        }
    }
`;

    // Insert before defaultConfig
    buildGradle = buildGradle.replace(
      /(\s+defaultConfig\s*{)/,
      splitConfig + '$1'
    );
    fs.writeFileSync(buildGradlePath, buildGradle);
  }

  // Build APKs
  log('Running Gradle assembleRelease...');
  exec('cd android && ./gradlew assembleRelease && cd ..');

  // Find all split APKs
  const apkDir = path.join(__dirname, '../android/app/build/outputs/apk/release');
  const apkFiles = fs.readdirSync(apkDir).filter(f => f.endsWith('.apk'));

  if (apkFiles.length === 0) {
    error('No APK files found after build');
  }

  const results = [];
  const archMapping = {
    'arm64-v8a': 'arm64-v8a',
    'armeabi-v7a': 'armeabi-v7a',
    'x86': 'x86',
    'x86_64': 'x86_64',
    'universal': 'universal'
  };

  // Copy each APK
  for (const apkFile of apkFiles) {
    const apkPath = path.join(apkDir, apkFile);

    // Extract architecture from filename
    let arch = 'universal';
    for (const [key, value] of Object.entries(archMapping)) {
      if (apkFile.includes(key)) {
        arch = value;
        break;
      }
    }

    const destFileName = `${APP_NAME}_${VERSION}_${arch}.apk`;
    const destPath = path.join(BUILD_DIR, destFileName);

    fs.copyFileSync(apkPath, destPath);
    results.push(destPath);
    console.log(`   ✓ ${destFileName}`);
  }

  success(`Built ${results.length} APK(s)`);
  return results;
}

function buildAAB() {
  log('Building Android App Bundle locally...');

  // Prebuild if needed
  if (!fs.existsSync(path.join(__dirname, '../android'))) {
    log('Running expo prebuild...');
    exec('npx expo prebuild --platform android');
  }

  // Build AAB
  log('Running Gradle bundleRelease...');
  exec('cd android && ./gradlew bundleRelease && cd ..');

  // Find the generated AAB
  const aabPath = path.join(__dirname, '../android/app/build/outputs/bundle/release/app-release.aab');

  if (!fs.existsSync(aabPath)) {
    error('AAB file not found after build');
  }

  const destFileName = `${APP_NAME}_${VERSION}_universal.aab`;
  const destPath = path.join(BUILD_DIR, destFileName);

  fs.copyFileSync(aabPath, destPath);
  success(`AAB built: ${destFileName}`);

  return destPath;
}

function buildIPA() {
  log('Building iOS IPA for simulator (can be sideloaded with AltStore/Sideloadly)...');

  // Check if running on macOS
  if (process.platform !== 'darwin') {
    error('iOS builds require macOS. Consider using EAS Build for cloud builds.');
  }

  const iosDir = path.join(__dirname, '../ios');
  const projectName = appJson.expo.name.replace(/\s+/g, ''); // Remove spaces
  const podfilePath = path.join(iosDir, 'Podfile');

  // Prebuild if needed (check for Podfile, not just ios/ folder)
  if (!fs.existsSync(podfilePath)) {
    log('Running expo prebuild for iOS...');
    exec('npx expo prebuild --platform ios');
  }
  const xcworkspace = path.join(iosDir, `${projectName}.xcworkspace`);
  const xcodeproj = path.join(iosDir, `${projectName}.xcodeproj`);

  // Determine which to use (workspace has priority if it exists)
  const buildTarget = fs.existsSync(xcworkspace)
    ? `-workspace "${xcworkspace}"`
    : `-project "${xcodeproj}"`;

  const scheme = projectName;
  const results = [];

  // ========================================
  // Build iOS Simulator IPA
  // ========================================
  log('\n--- Building for iOS Simulator ---');

  const simArchivePath = path.join(iosDir, 'build', `${APP_NAME}_simulator.xcarchive`);

  // Reinstall pods to apply SQLite fix (do this BEFORE clean to ensure workspace exists)
  log('Reinstalling CocoaPods to apply SQLite configuration...');
  exec('cd ios && pod install && cd ..');

  // Clean previous builds (after pod install, so workspace exists)
  log('Cleaning previous simulator builds...');
  exec(`cd ios && xcodebuild clean ${buildTarget} -scheme "${scheme}" -configuration Debug && cd ..`);

  // Build for simulator (arm64 architecture for Apple Silicon Macs)
  // Note: Using Debug configuration for simulator to skip React Native bundling (uses Metro bundler instead)
  log('Building for iOS Simulator (arm64) with Debug configuration...');
  const simArch = getArchitecture() === 'arm64' ? 'arm64' : 'x86_64';
  exec(`cd ios && xcodebuild archive ${buildTarget} -scheme "${scheme}" -configuration Debug -sdk iphonesimulator -arch ${simArch} -archivePath "${simArchivePath}" CODE_SIGN_IDENTITY="" CODE_SIGNING_REQUIRED=NO CODE_SIGNING_ALLOWED=NO && cd ..`);

  // Create simulator IPA by zipping the .app
  const simAppPath = path.join(simArchivePath, 'Products', 'Applications', `${projectName}.app`);
  if (fs.existsSync(simAppPath)) {
    const simIpaFileName = `${APP_NAME}_${VERSION}_simulator.ipa`;
    const simIpaPath = path.join(BUILD_DIR, simIpaFileName);

    // Create a temporary Payload directory
    const payloadDir = path.join(iosDir, 'build', 'Payload');
    if (fs.existsSync(payloadDir)) {
      fs.rmSync(payloadDir, { recursive: true, force: true });
    }
    fs.mkdirSync(payloadDir, { recursive: true });

    // Copy .app to Payload
    exec(`cp -r "${simAppPath}" "${payloadDir}/"`);

    // Create IPA (zip the Payload directory)
    exec(`cd "${path.join(iosDir, 'build')}" && zip -r "${simIpaPath}" Payload && cd ../..`);

    // Cleanup
    fs.rmSync(payloadDir, { recursive: true, force: true });

    results.push(simIpaPath);
    console.log(`   ✓ ${simIpaFileName}`);
  } else {
    console.warn(`   ⚠ Simulator .app not found at expected path`);
  }

  log('\n--- Note: For real device installation, use the simulator IPA with sideloading tools like AltStore or Sideloadly ---');

  if (results.length > 0) {
    success(`Built ${results.length} IPA file(s)`);
  } else {
    console.warn('No IPA files were created');
  }

  return results;
}

function buildWeb() {
  log('Building Web export...');

  exec('npx expo export --platform web');

  const distPath = path.join(__dirname, '../dist');
  if (!fs.existsSync(distPath)) {
    error('Web build directory not found');
  }

  // Create zip archive
  const zipFileName = `${APP_NAME}_${VERSION}_web.zip`;
  const zipPath = path.join(BUILD_DIR, zipFileName);

  log('Creating zip archive...');
  exec(`cd dist && zip -r "${zipPath}" . && cd ..`);

  success(`Web build created: ${zipFileName}`);
  return zipPath;
}

function showHelp() {
  console.log(`
Usage: npm run build:any <type> [type2 ...]

Build Types:
  apk     - ${BUILD_TYPES.apk.description}
  aab     - ${BUILD_TYPES.aab.description}
  ipa     - ${BUILD_TYPES.ipa.description}
  web     - ${BUILD_TYPES.web.description}
  all     - Build all types (apk, web, and submit aab/ipa to EAS)

Examples:
  npm run build:any apk           # Build Android APK only
  npm run build:any apk web       # Build APK and Web
  npm run build:any aab           # Submit AAB build to EAS
  npm run build:any all           # Build everything

Output Directory: _build/
File naming: ${APP_NAME}_${VERSION}_<arch>.<ext>
  `);
}

// Main
function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    showHelp();
    return;
  }

  // Clean _build directory first
  log('Cleaning _build directory...');
  if (fs.existsSync(BUILD_DIR)) {
    fs.rmSync(BUILD_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(BUILD_DIR, { recursive: true });
  success('_build directory cleaned and recreated');

  log(`Build Configuration:
   App Name: ${APP_NAME}
   Version: ${VERSION}
   Output Dir: ${BUILD_DIR}
  `);

  const buildTypes = args.includes('all')
    ? ['apk', 'web', 'aab', 'ipa']
    : args;

  // Validate all build types first
  for (const type of buildTypes) {
    if (!BUILD_TYPES[type]) {
      error(`Unknown build type: ${type}. Use --help to see available types.`);
    }
  }

  const results = [];

  // Build sequentially to avoid conflicts
  log(`Starting builds for: ${buildTypes.join(', ')}`);

  for (const type of buildTypes) {
    try {
      log(`\n[${'='.repeat(60)}]`);
      log(`Building ${type.toUpperCase()}...`);
      log(`[${'='.repeat(60)}]\n`);

      const result = BUILD_TYPES[type].build();

      if (result) {
        // Handle both single files and arrays of files
        if (Array.isArray(result)) {
          results.push(...result);
        } else {
          results.push(result);
        }
      }
    } catch (err) {
      console.error(`\n❌ Build failed for ${type}:`, err.message || err);
      // Continue with other builds even if one fails
    }
  }

  if (results.length > 0) {
    success(`Build complete! Files saved to: ${BUILD_DIR}`);
    console.log('Built files:');
    results.forEach(file => {
      console.log(`  - ${path.basename(file)}`);
    });
  } else {
    success('Cloud builds submitted! Check https://expo.dev/ for download links.');
  }
}

main();