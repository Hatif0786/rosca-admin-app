#!/usr/bin/env node
/**
 * update-release-manifest.js
 * 
 * Updates docs/website-blueprint/releases.json after a successful EAS APK build
 * and GitHub Release. Called by the GitHub Actions release workflow.
 *
 * Usage:
 *   node scripts/update-release-manifest.js \
 *     --version 1.0.0 \
 *     --versionCode 1 \
 *     --downloadUrl https://github.com/Hatif0786/rosca-admin-app/releases/download/v1.0.0/Rizqly-1.0.0.apk \
 *     --githubReleaseUrl https://github.com/Hatif0786/rosca-admin-app/releases/tag/v1.0.0 \
 *     --buildId abc123 \
 *     --apkFilename Rizqly-1.0.0.apk
 *
 * Test mode (validates script without writing):
 *   node scripts/update-release-manifest.js --test
 */

'use strict';

const fs = require('fs');
const path = require('path');

const MANIFEST_PATH = path.join(__dirname, '..', 'docs', 'website-blueprint', 'releases.json');

// ─── Argument parsing ──────────────────────────────────────────────────────────
const args = process.argv.slice(2);

function getArg(name) {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1) return null;
  return args[idx + 1] ?? null;
}

const isTest = args.includes('--test');

// ─── Test mode ─────────────────────────────────────────────────────────────────
if (isTest) {
  console.log('🧪 Test mode: validating script and current releases.json...');
  try {
    const raw = fs.readFileSync(MANIFEST_PATH, 'utf8');
    const data = JSON.parse(raw);
    console.log('✅ releases.json is valid JSON');
    console.log('   latestRelease:', data.latestRelease ? `v${data.latestRelease.version}` : 'null');
    console.log('   pendingRelease:', data.pendingRelease ? `v${data.pendingRelease.version} (${data.pendingRelease.status})` : 'null');
    console.log('   previousReleases:', (data.previousReleases || []).length, 'entries');
    console.log('✅ Script OK — ready for automation');
    process.exit(0);
  } catch (err) {
    console.error('❌ Validation failed:', err.message);
    process.exit(1);
  }
}

// ─── Required arguments ────────────────────────────────────────────────────────
const version     = getArg('version');
const versionCode = getArg('versionCode');
const downloadUrl = getArg('downloadUrl');
const githubUrl   = getArg('githubReleaseUrl');
const buildId     = getArg('buildId');
const apkFilename = getArg('apkFilename');

const missing = [];
if (!version)     missing.push('--version');
if (!versionCode) missing.push('--versionCode');
if (!downloadUrl) missing.push('--downloadUrl');
if (!githubUrl)   missing.push('--githubReleaseUrl');

if (missing.length > 0) {
  console.error('❌ Missing required arguments:', missing.join(', '));
  console.error('');
  console.error('Usage:');
  console.error('  node scripts/update-release-manifest.js \\');
  console.error('    --version 1.0.0 \\');
  console.error('    --versionCode 1 \\');
  console.error('    --downloadUrl https://github.com/.../Rizqly-1.0.0.apk \\');
  console.error('    --githubReleaseUrl https://github.com/.../releases/tag/v1.0.0 \\');
  console.error('    --buildId abc123 \\');
  console.error('    --apkFilename Rizqly-1.0.0.apk');
  process.exit(1);
}

// ─── Safety checks ─────────────────────────────────────────────────────────────
if (!downloadUrl.startsWith('https://')) {
  console.error('❌ downloadUrl must start with https://');
  process.exit(1);
}

if (!githubUrl.startsWith('https://github.com/')) {
  console.error('❌ githubReleaseUrl must be a valid GitHub URL');
  process.exit(1);
}

const versionRegex = /^\d+\.\d+\.\d+$/;
if (!versionRegex.test(version)) {
  console.error('❌ version must be in format X.Y.Z (e.g. 1.0.0)');
  process.exit(1);
}

// ─── Read existing manifest ────────────────────────────────────────────────────
let data;
try {
  const raw = fs.readFileSync(MANIFEST_PATH, 'utf8');
  data = JSON.parse(raw);
} catch (err) {
  console.error('❌ Failed to read releases.json:', err.message);
  process.exit(1);
}

// ─── Check for duplicate releases ─────────────────────────────────────────────
if (data.latestRelease && data.latestRelease.version === version) {
  console.error(`❌ Release v${version} already exists as latestRelease. Refusing to overwrite.`);
  process.exit(1);
}

const dupInHistory = (data.previousReleases || []).find(r => r.version === version);
if (dupInHistory) {
  console.error(`❌ Release v${version} already exists in previousReleases. Refusing to create duplicate.`);
  process.exit(1);
}

// ─── Build new release object ──────────────────────────────────────────────────
const releaseDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

const newRelease = {
  version,
  versionCode: parseInt(versionCode, 10),
  platform: 'android',
  status: 'STABLE',
  downloadUrl,
  buildId: buildId || null,
  githubReleaseUrl: githubUrl,
  apkFilename: apkFilename || `Rizqly-${version}.apk`,
  releaseDate,
  minimumSupportedVersion: '1.0.0',
  releaseNotes: data.pendingRelease?.releaseNotes || [
    `Rizqly v${version} release.`
  ],
};

// ─── Rotate manifest ───────────────────────────────────────────────────────────
const previousReleases = data.previousReleases || [];

// Move current latestRelease into history (if it exists)
if (data.latestRelease) {
  const archived = { ...data.latestRelease, status: 'SUPERSEDED' };
  previousReleases.unshift(archived);
}

const updatedManifest = {
  latestRelease: newRelease,
  pendingRelease: null,
  previousReleases,
};

// ─── Validate before writing ───────────────────────────────────────────────────
let serialized;
try {
  serialized = JSON.stringify(updatedManifest, null, 2);
  JSON.parse(serialized); // double-check round-trip
} catch (err) {
  console.error('❌ Failed to serialize updated manifest:', err.message);
  process.exit(1);
}

// ─── Write manifest ────────────────────────────────────────────────────────────
try {
  fs.writeFileSync(MANIFEST_PATH, serialized + '\n', 'utf8');
} catch (err) {
  console.error('❌ Failed to write releases.json:', err.message);
  process.exit(1);
}

// ─── Success ───────────────────────────────────────────────────────────────────
console.log(`✅ releases.json updated successfully`);
console.log(`   Version:     v${newRelease.version} (versionCode: ${newRelease.versionCode})`);
console.log(`   Status:      ${newRelease.status}`);
console.log(`   Release date: ${newRelease.releaseDate}`);
console.log(`   Download URL: ${newRelease.downloadUrl}`);
console.log(`   GitHub URL:   ${newRelease.githubReleaseUrl}`);
console.log(`   History:     ${previousReleases.length} previous release(s)`);
