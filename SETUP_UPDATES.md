# Setting Up Auto-Updates for SidQuest

## 1. Generate Signing Keys

First, you need to generate signing keys for your updates. Run this command and enter a password when prompted:

```bash
cd src-tauri
pnpm tauri signer generate -w ~/.tauri/sidquest.key
```

This will output:
- A **public key** (starts with "dW50cnVzdGVkIGNvbW1lbnQ6...")
- Save this public key - you'll need it for the next step

## 2. Configure Tauri for Updates

Update `src-tauri/tauri.conf.json` to add the updater configuration:

```json
{
  "plugins": {
    "updater": {
      "active": true,
      "endpoints": [
        "https://bryansh.github.io/sidquest-updates/latest.json"
      ],
      "dialog": false,
      "pubkey": "dW50cnVzdGVkIGNvbW1lbnQ6IHJzaWduIGVuY3J5cHRlZCBzZWNyZXQga2V5ClJXUlRZMEl5Smw2dG1xeDBoUUdHWTYyMzdhb3d0QW5YVGVPN3dpS3k5dWJqRkl6RVM5Y0FBQkFBQUFBQUFBQUFBSUFBQUFBc1VCbnpxN0tNN1NtVEJOOTJWRjlZTHowUS9kZGZuN1A5ak5PaldjOStmU0JMRDN5QUFXNUCMSR0UwRDMUYEhh3XC=="
    }
  },
  "bundle": {
    "createUpdaterArtifacts": true
  }
}
```

## 3. Set Up GitHub Repository

### Create Update Repository
1. Create a new GitHub repository called `sidquest-updates`
2. Enable GitHub Pages for this repository (Settings → Pages → Source: Deploy from a branch → Branch: main)

### Create Update JSON Structure
In the `sidquest-updates` repository, create `latest.json`:

```json
{
  "version": "0.1.0",
  "notes": "Initial release",
  "pub_date": "2025-01-09T00:00:00Z",
  "platforms": {
    "darwin-aarch64": {
      "signature": "",
      "url": "https://github.com/bryansh/sidquest/releases/download/v0.1.0/sidquest_0.1.0_aarch64.dmg"
    },
    "darwin-x86_64": {
      "signature": "",
      "url": "https://github.com/bryansh/sidquest/releases/download/v0.1.0/sidquest_0.1.0_x64.dmg"
    },
    "linux-x86_64": {
      "signature": "",
      "url": "https://github.com/bryansh/sidquest/releases/download/v0.1.0/sidquest_0.1.0_amd64.AppImage"
    },
    "windows-x86_64": {
      "signature": "",
      "url": "https://github.com/bryansh/sidquest/releases/download/v0.1.0/sidquest_0.1.0_x64-setup.exe"
    }
  }
}
```

## 4. GitHub Actions for Automated Releases

Create `.github/workflows/release.yml` in your main sidquest repository:

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    strategy:
      matrix:
        platform: [macos-latest, ubuntu-latest, windows-latest]
    runs-on: ${{ matrix.platform }}

    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
      
      - name: Install Rust
        uses: dtolnay/rust-toolchain@stable
      
      - name: Install dependencies (Ubuntu)
        if: matrix.platform == 'ubuntu-latest'
        run: |
          sudo apt-get update
          sudo apt-get install -y libgtk-3-dev libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev
      
      - name: Install pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8
      
      - name: Install frontend dependencies
        run: pnpm install
      
      - name: Build Tauri app
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_KEY_PASSWORD }}
        with:
          tagName: v__VERSION__
          releaseName: 'SidQuest v__VERSION__'
          releaseBody: 'See the assets to download this version and install.'
          releaseDraft: true
          prerelease: false
```

## 5. Set Up GitHub Secrets

In your GitHub repository settings, add these secrets:
- `TAURI_PRIVATE_KEY`: Contents of `~/.tauri/sidquest.key`
- `TAURI_KEY_PASSWORD`: The password you used when generating the key

## 6. Version Bumping

Create `scripts/bump-version.js`:

```javascript
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const type = process.argv[2];
if (!['patch', 'minor', 'major'].includes(type)) {
  console.error('Usage: node bump-version.js [patch|minor|major]');
  process.exit(1);
}

// Update package.json
const packagePath = 'package.json';
const package = JSON.parse(readFileSync(packagePath, 'utf8'));
const [major, minor, patch] = package.version.split('.').map(Number);

let newVersion;
if (type === 'major') newVersion = `${major + 1}.0.0`;
else if (type === 'minor') newVersion = `${major}.${minor + 1}.0`;
else newVersion = `${major}.${minor}.${patch + 1}`;

package.version = newVersion;
writeFileSync(packagePath, JSON.stringify(package, null, 2) + '\n');

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
```

Add to `package.json` scripts:

```json
{
  "scripts": {
    "bump:patch": "node scripts/bump-version.js patch",
    "bump:minor": "node scripts/bump-version.js minor",
    "bump:major": "node scripts/bump-version.js major"
  }
}
```

## 7. Release Process

1. Bump version: `pnpm bump:patch` (or minor/major)
2. Commit: `git commit -am "v0.1.1"`
3. Tag: `git tag v0.1.1`
4. Push: `git push && git push --tags`
5. GitHub Actions will build and create a draft release
6. Edit the release notes and publish
7. Update the `sidquest-updates/latest.json` with new version info and signatures

## 8. Getting Signatures

After the release artifacts are built, sign them:

```bash
cd path/to/release/artifacts
tauri signer sign -k ~/.tauri/sidquest.key sidquest_0.1.0_aarch64.dmg
```

This will output a signature string to add to your `latest.json`.

## Important Notes

- The public key in `tauri.conf.json` must match your signing key
- The update endpoint URL must be accessible (GitHub Pages works well)
- Signatures are required for updates to work
- Test updates with a lower version number first