import { describe, expect, it } from 'vitest';

import {
  DsvgCompileError,
  compileDsvg,
  parseDsvg,
  readPrintMeta,
  resolveTrimRect,
  stripDsvgAttributes,
  validateDsvg,
} from '../src/index.js';

const printCardSource = `<svg
  xmlns="http://www.w3.org/2000/svg"
  data-dsvg-version="0.1"
  width="750"
  height="1050"
  viewBox="0 0 750 1050"
  data-dsvg-trim-width="690"
  data-dsvg-trim-height="990"
  data-dsvg-bleed="30"
  data-dsvg-safe-area="24"
  data-dsvg-corner-radius="24"
  data-dsvg-dpi="300"
>
  <rect width="750" height="1050" fill="#f5f5f5"/>
  <rect x="30" y="30" width="690" height="990" fill="#ffffff"/>
</svg>`;

describe('print metadata validation', () => {
  it('accepts root print metadata', async () => {
    const doc = await parseDsvg(printCardSource);
    const result = validateDsvg(doc);
    expect(result.ok).toBe(true);
  });

  it('defaults units to px when omitted', async () => {
    const doc = await parseDsvg(printCardSource);
    const meta = readPrintMeta(doc);
    expect(meta?.units).toBe('px');
    expect(meta?.trim).toEqual({ width: 690, height: 990 });
    expect(meta?.bleed).toEqual({ top: 30, right: 30, bottom: 30, left: 30 });
    expect(meta?.safeArea).toEqual({ top: 24, right: 24, bottom: 24, left: 24 });
    expect(meta?.cornerRadius).toBe(24);
    expect(meta?.dpi).toBe(300);
  });

  it('rejects print metadata on non-root elements', async () => {
    const doc =
      await parseDsvg(`<svg xmlns="http://www.w3.org/2000/svg" data-dsvg-version="0.1" width="10" height="10">
      <g data-dsvg-bleed="2"><rect width="10" height="10"/></g>
    </svg>`);
    const result = validateDsvg(doc);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((error) => error.code === 'INVALID_ATTRIBUTE')).toBe(true);
    }
  });

  it('requires trim width and height together', async () => {
    const doc = await parseDsvg(
      `<svg xmlns="http://www.w3.org/2000/svg" data-dsvg-version="0.1" width="10" height="10" data-dsvg-trim-width="8"/>`,
    );
    const result = validateDsvg(doc);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((error) => error.message.includes('must be set together'))).toBe(
        true,
      );
    }
  });

  it('resolves side bleed overrides', async () => {
    const doc = await parseDsvg(
      `<svg xmlns="http://www.w3.org/2000/svg" data-dsvg-version="0.1" width="100" height="100" data-dsvg-bleed="10" data-dsvg-bleed-left="5" data-dsvg-trim-width="80" data-dsvg-trim-height="80"/>`,
    );
    const meta = readPrintMeta(doc);
    expect(meta?.bleed).toEqual({ top: 10, right: 10, bottom: 10, left: 5 });
  });
});

describe('print / preview compile output', () => {
  it('keeps full bleed canvas in print mode and strips meta by default', async () => {
    const result = await compileDsvg(printCardSource, { outputMode: 'print' });
    expect(result.document.attributes.width).toBe('750');
    expect(result.document.attributes.height).toBe('1050');
    expect(result.svg).not.toContain('data-dsvg-');
    expect(result.svg).not.toContain('dsvg-preview-clip');
  });

  it('keeps print meta when keepMeta is true', async () => {
    const result = await compileDsvg(printCardSource, {
      outputMode: 'print',
      keepMeta: true,
    });
    expect(result.document.attributes['data-dsvg-trim-width']).toBe('690');
    expect(result.document.attributes['data-dsvg-version']).toBeUndefined();
    expect(result.svg).toContain('data-dsvg-trim-width="690"');
  });

  it('crops to trim and clips corners in preview mode', async () => {
    const result = await compileDsvg(printCardSource, { outputMode: 'preview' });
    expect(result.document.attributes.width).toBe('690');
    expect(result.document.attributes.height).toBe('990');
    expect(result.document.attributes.viewBox).toBe('0 0 690 990');
    expect(result.svg).toContain('id="dsvg-preview-clip"');
    expect(result.svg).toContain('clip-path="url(#dsvg-preview-clip)"');
    expect(result.svg).toContain('translate(-30, -30)');
    expect(result.svg).toContain('rx="24"');
  });

  it('preview without corner radius still crops', async () => {
    const source = `<svg xmlns="http://www.w3.org/2000/svg" data-dsvg-version="0.1" width="100" height="80" data-dsvg-trim-width="80" data-dsvg-trim-height="60" data-dsvg-bleed="10">
      <rect width="100" height="80" fill="#ccc"/>
    </svg>`;
    const result = await compileDsvg(source, { outputMode: 'preview' });
    expect(result.document.attributes.width).toBe('80');
    expect(result.document.attributes.height).toBe('60');
    expect(result.svg).not.toContain('dsvg-preview-clip');
    expect(result.svg).toContain('translate(-10, -10)');
  });

  it('fails preview when trim is missing', async () => {
    const source = `<svg xmlns="http://www.w3.org/2000/svg" data-dsvg-version="0.1" width="100" height="100" data-dsvg-bleed="5"><rect width="100" height="100"/></svg>`;
    await expect(compileDsvg(source, { outputMode: 'preview' })).rejects.toBeInstanceOf(
      DsvgCompileError,
    );
    try {
      await compileDsvg(source, { outputMode: 'preview' });
    } catch (error) {
      expect(error).toBeInstanceOf(DsvgCompileError);
      if (error instanceof DsvgCompileError) {
        expect(error.errors[0]?.code).toBe('INVALID_PRINT_PREVIEW');
      }
    }
  });

  it('resolveTrimRect maps bleed box to user space', async () => {
    const doc = await parseDsvg(printCardSource);
    const mapped = resolveTrimRect(doc);
    expect(mapped.ok).toBe(true);
    if (mapped.ok) {
      expect(mapped.rect).toEqual({
        x: 30,
        y: 30,
        width: 690,
        height: 990,
        cornerRadius: 24,
      });
    }
  });

  it('stripDsvgAttributes keepMeta preserves only print attrs', async () => {
    const doc =
      await parseDsvg(`<svg xmlns="http://www.w3.org/2000/svg" data-dsvg-version="0.1" width="100" height="100" data-dsvg-trim-width="80" data-dsvg-trim-height="80" data-dsvg-bleed="10">
      <g data-dsvg-layout="flex" data-dsvg-width="100" data-dsvg-height="100"><rect width="10" height="10"/></g>
    </svg>`);
    const stripped = stripDsvgAttributes(doc, { keepMeta: true });
    expect(stripped.attributes['data-dsvg-trim-width']).toBe('80');
    expect(stripped.attributes['data-dsvg-version']).toBeUndefined();
    expect(stripped.children[0]?.attributes['data-dsvg-layout']).toBeUndefined();
  });
});
