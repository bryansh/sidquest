#!/usr/bin/env node

import fs from 'fs';
import { execSync } from 'child_process';

const type = process.argv[2];
if (!['patch', 'minor', 'major'].includes(type)) {
  console.error('Usage: node scripts/bump-version.js [patch|minor|major]');
  process.exit(1);
}

// Get the new version from npm version (but don't commit yet)
const newVersion = execSync(`npm version ${type} --no-git-tag-version`, { encoding: 'utf8' }).trim().replace('v', '');
console.log(`Bumping to version ${newVersion}`);

// Update tauri.conf.json
const tauriConfigPath = 'src-tauri/tauri.conf.json';
const tauriConfig = JSON.parse(fs.readFileSync(tauriConfigPath, 'utf8'));
tauriConfig.version = newVersion;
fs.writeFileSync(tauriConfigPath, JSON.stringify(tauriConfig, null, 2) + '\n');
console.log(`✓ Updated ${tauriConfigPath}`);

// Update Cargo.toml
const cargoPath = 'src-tauri/Cargo.toml';
let cargoContent = fs.readFileSync(cargoPath, 'utf8');
cargoContent = cargoContent.replace(/^version = ".*"$/m, `version = "${newVersion}"`);
fs.writeFileSync(cargoPath, cargoContent);
console.log(`✓ Updated ${cargoPath}`);

// Update Cargo.lock to reflect the new version
execSync('cd src-tauri && cargo update -p sidquest', { stdio: 'inherit' });
console.log(`✓ Updated Cargo.lock`);

// Git operations
execSync('git add -A', { stdio: 'inherit' });
execSync(`git commit -m "Bump version to ${newVersion}"`, { stdio: 'inherit' });
execSync(`git tag -a v${newVersion} -m "Version ${newVersion}"`, { stdio: 'inherit' });

console.log(`\n✅ Version bumped to ${newVersion}`);
console.log('To release, run: git push && git push --tags');