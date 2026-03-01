const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

process.env.BUILD_FOR = 'electron';
// Skip code signing so build works without admin/symlink permissions (unsigned .exe is fine for local use)
process.env.CSC_IDENTITY_AUTO_DISCOVERY = 'false';
process.chdir(path.join(__dirname, '..'));

console.log('Building Vite app for Electron...');
execSync('npx vite build', { stdio: 'inherit', env: process.env });

// Use a fresh output dir each build to avoid "file in use" when previous .exe is still running.
// signAndEditExecutable: false skips code signing (avoids winCodeSign symlink errors on Windows).
const timestamp = Date.now();
const outputDir = `release-${timestamp}`;
const configOverride = path.join(__dirname, '..', 'electron-builder-override.json');
const fullBuildConfig = {
  appId: 'com.endless-seven.app',
  productName: 'Endless Seven',
  files: ['dist/**', 'electron/**'],
  directories: { output: outputDir },
  win: { target: 'nsis', signAndEditExecutable: false },
  mac: { target: 'dmg', category: 'public.app-category.games' },
  linux: { target: 'AppImage' }
};
fs.writeFileSync(configOverride, JSON.stringify(fullBuildConfig));

console.log('Packaging with electron-builder (Windows .exe)...');
const electronBuilderCli = path.join(__dirname, '..', 'node_modules', 'electron-builder', 'cli.js');
try {
  execSync(`node "${electronBuilderCli}" --win --config electron-builder-override.json`, { stdio: 'inherit', env: process.env });
  const cwd = process.cwd();
  const portableExe = path.join(cwd, outputDir, 'win-unpacked', 'Endless Seven.exe');
  const nsisExe = path.join(cwd, outputDir, 'Endless Seven Setup 0.0.0.exe');
  console.log('\nDone. Windows .exe output:');
  if (fs.existsSync(portableExe)) {
    console.log('  Portable:', path.join(outputDir, 'win-unpacked', 'Endless Seven.exe'));
  }
  if (fs.existsSync(nsisExe)) {
    console.log('  Installer:', path.join(outputDir, 'Endless Seven Setup 0.0.0.exe'));
  }
} finally {
  try { fs.unlinkSync(configOverride); } catch (_) {}
}
