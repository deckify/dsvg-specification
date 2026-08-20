#!/usr/bin/env node
/**
 * Pre-commit guard: publishable TypeScript package changes need a staged changeset.
 *
 * Bypass (emergency only): SKIP_CHANGESET_CHECK=1
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Lists staged file paths for the given diff filter.
 * @param {string} filter - git `--diff-filter` value.
 * @returns {string[]} Staged paths relative to repo root.
 */
const stagedFiles = (filter) => {
  const output = execSync(`git diff --cached --name-only --diff-filter=${filter}`, {
    encoding: 'utf8',
    cwd: root,
  });
  return output.split('\n').filter(Boolean);
};

/**
 * Reads Changesets ignore list from config.
 * @returns {Set<string>} Package names ignored by Changesets.
 */
const readIgnoredPackages = () => {
  try {
    const config = JSON.parse(readFileSync(join(root, '.changeset/config.json'), 'utf8'));
    return new Set(Array.isArray(config.ignore) ? config.ignore : []);
  } catch {
    return new Set();
  }
};

/**
 * Maps a staged path under implementations/typescript to its package name, if any.
 * @param {string} filePath - Staged file path.
 * @returns {string | undefined} Package name, or undefined when not publishable.
 */
const packageNameForPath = (filePath) => {
  const match = /^implementations\/typescript\/([^/]+)\//.exec(filePath);
  if (!match) {
    return undefined;
  }
  const dir = match[1];
  try {
    const pkg = JSON.parse(
      readFileSync(join(root, 'implementations/typescript', dir, 'package.json'), 'utf8'),
    );
    if (!pkg.name || pkg.private === true) {
      return undefined;
    }
    return pkg.name;
  } catch {
    return undefined;
  }
};

/**
 * Returns whether a path should trigger the changeset requirement.
 * @param {string} filePath - Staged file path.
 * @returns {boolean} True when the file is a meaningful publishable package change.
 */
const isPublishablePackageChange = (filePath) => {
  if (!/^implementations\/typescript\/[^/]+\//.test(filePath)) {
    return false;
  }
  if (filePath.endsWith('/CHANGELOG.md')) {
    return false;
  }
  if (/(^|\/)dist\//.test(filePath)) {
    return false;
  }
  return true;
};

/**
 * Returns whether a staged path is a changeset markdown entry.
 * @param {string} filePath - Staged file path.
 * @returns {boolean} True for `.changeset/*.md` except README.
 */
const isChangesetEntry = (filePath) =>
  /^\.changeset\/.+\.md$/.test(filePath) && !filePath.endsWith('/README.md');

if (process.env.SKIP_CHANGESET_CHECK === '1') {
  process.exit(0);
}

const addedOrModified = stagedFiles('ACMR');
const deleted = stagedFiles('D');
const ignored = readIgnoredPackages();

const touchedPublishable = [
  ...new Set(
    addedOrModified
      .filter(isPublishablePackageChange)
      .map(packageNameForPath)
      .filter((name) => typeof name === 'string' && !ignored.has(name)),
  ),
];

if (touchedPublishable.length === 0) {
  process.exit(0);
}

const hasStagedChangeset = addedOrModified.some(isChangesetEntry);

// Version PRs delete changeset files and refresh CHANGELOG / package.json.
const isVersionPackagesCommit =
  deleted.some(isChangesetEntry) &&
  addedOrModified.some((filePath) => filePath.endsWith('/CHANGELOG.md'));

if (hasStagedChangeset || isVersionPackagesCommit) {
  process.exit(0);
}

console.error(
  [
    'Missing changeset for publishable package changes.',
    `Touched: ${touchedPublishable.join(', ')}`,
    '',
    'Run: pnpm changeset',
    'Stage the new .changeset/*.md file, then commit again.',
    '',
    'Emergency bypass: SKIP_CHANGESET_CHECK=1',
  ].join('\n'),
);
process.exit(1);
