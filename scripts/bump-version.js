import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const type = process.argv[2];
if (!['patch', 'minor', 'major'].includes(type)) {
  console.error('Usage: node bump-version.js [patch|minor|major]');
  process.exit(1);
}

// Update package.json
const packagePath = 'package.json';
const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
const [major, minor, patch] = packageJson.version.split('.').map(Number);

let newVersion;
if (type === 'major') newVersion = `${major + 1}.0.0`;
else if (type === 'minor') newVersion = `${major}.${minor + 1}.0`;
else newVersion = `${major}.${minor}.${patch + 1}`;

packageJson.version = newVersion;
writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');

// Update tauri.conf.json
const tauriPath = join('src-tauri', 'tauri.conf.json');
const tauriConf = JSON.parse(readFileSync(tauriPath, 'utf8'));
tauriConf.version = newVersion;
writeFileSync(tauriPath, JSON.stringify(tauriConf, null, 2) + '\n');

// Update Cargo.toml
const cargoPath = join('src-tauri', 'Cargo.toml');
let cargo = readFileSync(cargoPath, 'utf8');
cargo = cargo.replace(/^version = ".*"/m, `version = "${newVersion}"`);
writeFileSync(cargoPath, cargo);

console.log(`Version bumped to ${newVersion}`);