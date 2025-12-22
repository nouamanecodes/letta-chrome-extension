/* File: copy-assets.js */

const fs = require("fs");
const path = require("path");

const srcDir = path.join(__dirname, "..", "src");
const distDir = path.join(__dirname, "..", "dist");

// Create dist directory if it doesn't exist
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Files to copy
const filesToCopy = ["popup.html", "popup.css", "overview.html", "overview.css", "manifest.json"];

// Copy each file
let failureCount = 0;
filesToCopy.forEach(file => {
  const srcPath = path.join(srcDir, file);
  const distPath = path.join(distDir, file);

  try {
    fs.copyFileSync(srcPath, distPath);
    console.log(`✓ Copied ${file}`);
  } catch (error) {
    console.error(`✗ Failed to copy ${file}:`, error.message);
    failureCount++;
  }
});

if (failureCount === 0) {
  console.log("\n✓ Assets copied successfully!");
} else {
  console.error(`\n✗ Failed to copy ${failureCount} file(s).`);
  process.exit(1);
}
