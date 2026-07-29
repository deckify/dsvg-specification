import { describe, expect, it } from 'vitest';

import { getDsvgSourceExtension, isDsvgFilename, toCompiledSvgFilename } from '../src/filename.js';

describe('filename helpers', () => {
  it('recognizes .dsvg and .d.svg only', () => {
    expect(isDsvgFilename('badge.dsvg')).toBe(true);
    expect(isDsvgFilename('badge.d.svg')).toBe(true);
    expect(isDsvgFilename('badge.D.SVG')).toBe(true);
    expect(isDsvgFilename('badge.svg')).toBe(false);
    expect(isDsvgFilename('badge.xml')).toBe(false);
  });

  it('returns source extensions', () => {
    expect(getDsvgSourceExtension('a.dsvg')).toBe('.dsvg');
    expect(getDsvgSourceExtension('a.d.svg')).toBe('.d.svg');
    expect(getDsvgSourceExtension('a.svg')).toBeUndefined();
  });

  it('maps sources to compiled .svg filenames', () => {
    expect(toCompiledSvgFilename('badge.dsvg')).toBe('badge.svg');
    expect(toCompiledSvgFilename('badge.d.svg')).toBe('badge.svg');
    expect(toCompiledSvgFilename('badge.svg')).toBe('badge.svg');
  });
});
