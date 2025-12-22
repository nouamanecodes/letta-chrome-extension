/* File: scripts/build.js */

const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

// Ensure dist directory exists
if (!fs.existsSync("dist")) {
  fs.mkdirSync("dist", { recursive: true });
}

// Build configurations
const buildConfigs = [
  {
    name: "universal-injector.js",
    config: {
      entryPoints: ["src/universal-injector.ts"],
      bundle: true,
      outfile: "dist/universal-injector.js",
      format: "iife",
      platform: "browser",
      target: "es2020",
      sourcemap: false,
    },
  },
  {
    name: "background.js",
    config: {
      entryPoints: ["src/background.ts"],
      bundle: true,
      outfile: "dist/background.js",
      format: "iife",
      platform: "browser",
      target: "es2020",
      sourcemap: false,
    },
  },
  {
    name: "popup.js",
    config: {
      entryPoints: ["src/popup.ts"],
      bundle: true,
      outfile: "dist/popup.js",
      format: "iife",
      platform: "browser",
      target: "es2020",
      sourcemap: false,
    },
  },
  {
    name: "overview.js",
    config: {
      entryPoints: ["src/overview.ts"],
      bundle: true,
      outfile: "dist/overview.js",
      format: "iife",
      platform: "browser",
      target: "es2020",
      sourcemap: false,
    },
  },
  {
    name: "onboarding.js",
    config: {
      entryPoints: ["src/onboarding.ts"],
      bundle: true,
      outfile: "dist/onboarding.js",
      format: "iife",
      platform: "browser",
      target: "es2020",
      sourcemap: false,
    },
  },
];

// Run all builds concurrently and wait for all to complete
async function build() {
  try {
    const buildPromises = buildConfigs.map(({ name, config }) =>
      esbuild
        .build(config)
        .then(() => {
          console.log(`✓ Built ${name}`);
          return { name, success: true };
        })
        .catch(err => {
          console.error(`✗ Failed to build ${name}:`, err.stack || err.message || err);
          return { name, success: false, error: err };
        })
    );

    const results = await Promise.all(buildPromises);
    const failures = results.filter(r => !r.success);

    if (failures.length > 0) {
      console.error(`\n✗ Build failed: ${failures.length} bundle(s) failed`);
      process.exit(1);
    }

    // Copy static files from src/
    copyStaticFiles();

    console.log("\n✓ Build completed successfully!");
  } catch (err) {
    console.error("Build failed:", err.stack || err.message || err);
    process.exit(1);
  }
}

function copyStaticFiles() {
  const filesToCopy = [
    "src/popup.html",
    "src/popup.css",
    "src/overview.html",
    "src/overview.css",
    "src/onboarding.html",
    "src/onboarding.css",
    "src/manifest.json",
  ];

  filesToCopy.forEach(file => {
    const fileName = path.basename(file);
    const srcPath = path.join(__dirname, "..", file);
    const distPath = path.join(__dirname, "..", "dist", fileName);

    try {
      fs.copyFileSync(srcPath, distPath);
      console.log(`✓ Copied ${fileName}`);
    } catch (error) {
      console.error(`✗ Failed to copy ${fileName}:`, error.message);
    }
  });

  // Copy assets (icons, images)
  const assetsDir = path.join(__dirname, "..", "assets");
  const distDir = path.join(__dirname, "..", "dist");

  if (fs.existsSync(assetsDir)) {
    const assets = fs.readdirSync(assetsDir);
    assets.forEach(asset => {
      const srcPath = path.join(assetsDir, asset);
      const distPath = path.join(distDir, asset);

      try {
        // Skip directories and hidden files
        if (fs.statSync(srcPath).isDirectory() || asset.startsWith(".")) {
          return;
        }

        fs.copyFileSync(srcPath, distPath);
        console.log(`✓ Copied asset: ${asset}`);
      } catch (error) {
        console.error(`✗ Failed to copy asset ${asset}:`, error.message);
      }

      try {
        fs.copyFileSync(srcPath, distPath);
        console.log(`✓ Copied asset: ${asset}`);
      } catch (error) {
        console.error(`✗ Failed to copy asset ${asset}:`, error.message);
      }
    });
  }

  // Copy icon.png if it exists at root (for manifest icons)
  const iconPath = path.join(__dirname, "..", "icon.png");
  if (fs.existsSync(iconPath)) {
    fs.copyFileSync(iconPath, path.join(distDir, "icon.png"));
    console.log("✓ Copied icon.png");
  }

  // Copy letta-icon.svg if it exists at root (for web_accessible_resources)
  const svgIconPath = path.join(__dirname, "..", "letta-icon.svg");
  if (fs.existsSync(svgIconPath)) {
    fs.copyFileSync(svgIconPath, path.join(distDir, "letta-icon.svg"));
    console.log("✓ Copied letta-icon.svg");
  }
}

// Run the build
build();
