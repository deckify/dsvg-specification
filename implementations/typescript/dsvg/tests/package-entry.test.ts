import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const distEsm = pathToFileURL(join(packageRoot, 'dist/index.js')).href;
const require = createRequire(import.meta.url);

describe('published package entry', () => {
  it('loads the ESM build and compiles', async () => {
    const mod = await import(distEsm);
    expect(mod.DSVG_SPEC_VERSION).toBe('0.1');
    expect(typeof mod.compileDsvg).toBe('function');

    const result = await mod.compileDsvg(
      `<svg xmlns="http://www.w3.org/2000/svg" data-dsvg-version="0.1" width="40" height="40">
        <rect width="{{size}}" height="{{size}}" fill="#123"/>
      </svg>`,
      { variables: { size: 20 }, textMeasurement: 'skip' },
    );
    expect(result.svg).toContain('width="20"');
    expect(result.svg).not.toContain('data-dsvg-');
  });

  it('exports ESM entry for import and default conditions', () => {
    const pkg = require('../package.json') as {
      exports?: { '.'?: { require?: string; import?: string; default?: string } };
      main?: string;
    };
    expect(pkg.exports?.['.']?.require).toBeUndefined();
    expect(pkg.main).toBe('./dist/index.js');
    expect(pkg.exports?.['.']?.import).toBe('./dist/index.js');
    expect(pkg.exports?.['.']?.default).toBe('./dist/index.js');
  });
});
