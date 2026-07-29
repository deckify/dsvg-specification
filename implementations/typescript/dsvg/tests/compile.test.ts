import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  DsvgCompileError,
  applyYogaLayout,
  compileDsvg,
  compileDsvgDocument,
  parseDsvg,
  renderTemplate,
  serializeDsvg,
  validateDsvg,
} from '../src/index.js';

const examplesDir = join(dirname(fileURLToPath(import.meta.url)), '../../../../examples');

/**
 * Reads an example fixture from the shared examples directory.
 * @param name - Fixture filename.
 * @returns File contents.
 */
const readExample = (name: string): string => readFileSync(join(examplesDir, name), 'utf8');

describe('parse / serialize', () => {
  it('round-trips a simple document', async () => {
    const source = `<svg xmlns="http://www.w3.org/2000/svg" data-dsvg-version="0.1" width="10" height="10"><rect width="10" height="10"/></svg>`;
    const doc = await parseDsvg(source);
    expect(doc.name).toBe('svg');
    expect(doc.attributes['data-dsvg-version']).toBe('0.1');
    const again = await parseDsvg(serializeDsvg(doc));
    expect(again.attributes.width).toBe('10');
  });

  it('accepts XML declarations and DOCTYPE before the svg root', async () => {
    const doc = await parseDsvg(
      `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n<svg xmlns="http://www.w3.org/2000/svg" data-dsvg-version="0.1" width="1" height="1"/>`,
    );
    expect(doc.name).toBe('svg');
  });

  it('rejects non-svg roots', async () => {
    await expect(parseDsvg('<div></div>')).rejects.toBeInstanceOf(DsvgCompileError);
  });

  it('serializes text and attributes without CDATA or double-escaping', async () => {
    const doc = await parseDsvg(
      `<svg xmlns="http://www.w3.org/2000/svg" data-dsvg-version="0.1" width="1" height="1">
        <text>{{label}}</text>
        <rect aria-label="{{label}}"/>
      </svg>`,
    );
    const rendered = await renderTemplate(doc, { label: 'A & B "q"' });
    const svg = serializeDsvg(rendered);
    expect(svg).toContain('>A &amp; B "q"<');
    expect(svg).toContain('aria-label="A &amp; B &quot;q&quot;"');
    expect(svg).not.toContain('CDATA');
    expect(svg).not.toContain('&amp;amp;');
  });
});

describe('validate', () => {
  it('requires data-dsvg-version 0.1', async () => {
    const doc = await parseDsvg(
      `<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>`,
    );
    const result = validateDsvg(doc);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((error) => error.code === 'UNSUPPORTED_VERSION')).toBe(true);
    }
  });

  it('rejects unknown keywords', async () => {
    const doc = await parseDsvg(
      `<svg xmlns="http://www.w3.org/2000/svg" data-dsvg-version="0.1" width="100" height="100">
        <g data-dsvg-layout="flex" data-dsvg-justify-content="space-around-ish" data-dsvg-width="100" data-dsvg-height="100"></g>
      </svg>`,
    );
    const result = validateDsvg(doc);
    expect(result.ok).toBe(false);
  });

  it('rejects unsupported mustache sections', async () => {
    const doc = await parseDsvg(
      `<svg xmlns="http://www.w3.org/2000/svg" data-dsvg-version="0.1" width="1" height="1">
        <text>{{#items}}x{{/items}}</text>
      </svg>`,
    );
    const result = validateDsvg(doc);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((error) => error.code === 'UNSUPPORTED_MUSTACHE')).toBe(true);
    }
  });

  it('rejects container attrs outside flex groups and child attrs outside flex children', async () => {
    const doc = await parseDsvg(
      `<svg xmlns="http://www.w3.org/2000/svg" data-dsvg-version="0.1" width="100" height="100">
        <rect data-dsvg-flex-direction="row" data-dsvg-flex-grow="1" width="10" height="10"/>
      </svg>`,
    );
    const result = validateDsvg(doc);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((error) => error.code === 'INVALID_ATTRIBUTE')).toBe(true);
    }
  });
});

describe('template', () => {
  it('escapes {{name}} and injects {{{raw}}} as markup', async () => {
    const doc = await parseDsvg(
      `<svg xmlns="http://www.w3.org/2000/svg" data-dsvg-version="0.1" width="1" height="1">
        <text>{{label}}</text>
        <text>{{{raw}}}</text>
      </svg>`,
    );
    const rendered = await renderTemplate(doc, {
      label: '<b>Hi</b>',
      raw: '<tspan>x</tspan>',
    });
    const texts = rendered.children.filter((child) => child.name === 'text');
    expect(texts[0]?.children[0]?.value).toBe('&lt;b&gt;Hi&lt;/b&gt;');
    expect(texts[1]?.children.some((child) => child.name === 'tspan')).toBe(true);
    const svg = serializeDsvg(rendered);
    expect(svg).toContain('&lt;b&gt;Hi&lt;/b&gt;');
    expect(svg).toContain('<tspan>x</tspan>');
    expect(svg).not.toContain('CDATA');
  });

  it('supports dotted paths and {{& name}}', async () => {
    const doc = await parseDsvg(
      `<svg xmlns="http://www.w3.org/2000/svg" data-dsvg-version="0.1" width="1" height="1">
        <text>{{label.title}}</text>
        <text>{{& label.raw}}</text>
      </svg>`,
    );
    const rendered = await renderTemplate(doc, {
      label: { title: 'Ace', raw: '<tspan>A</tspan>' },
    });
    expect(serializeDsvg(rendered)).toContain('Ace');
    expect(serializeDsvg(rendered)).toContain('<tspan>A</tspan>');
  });

  it('errors on missing variables by default', async () => {
    const doc = await parseDsvg(
      `<svg xmlns="http://www.w3.org/2000/svg" data-dsvg-version="0.1" width="1" height="1">
        <text>{{missing}}</text>
      </svg>`,
    );
    await expect(renderTemplate(doc, {})).rejects.toBeInstanceOf(DsvgCompileError);
  });

  it('allows missing variables in non-strict mode', async () => {
    const doc = await parseDsvg(
      `<svg xmlns="http://www.w3.org/2000/svg" data-dsvg-version="0.1" width="1" height="1">
        <text>Hello {{missing}}</text>
      </svg>`,
    );
    const rendered = await renderTemplate(doc, {}, { strictMissing: false });
    expect(serializeDsvg(rendered)).toContain('Hello ');
  });

  it('does not mutate the input document', async () => {
    const doc = await parseDsvg(
      `<svg xmlns="http://www.w3.org/2000/svg" data-dsvg-version="0.1" width="1" height="1">
        <text>{{name}}</text>
      </svg>`,
    );
    await renderTemplate(doc, { name: 'Alice' });
    expect(doc.children[0]?.children[0]?.value).toContain('{{name}}');
  });
});

describe('layout', () => {
  it('positions row children with gap', async () => {
    const doc = await parseDsvg(
      `<svg xmlns="http://www.w3.org/2000/svg" data-dsvg-version="0.1" width="300" height="100">
        <g data-dsvg-layout="flex" data-dsvg-flex-direction="row" data-dsvg-gap="20" data-dsvg-width="300" data-dsvg-height="100">
          <rect width="40" height="40" fill="#f00"/>
          <rect width="40" height="40" fill="#0f0"/>
        </g>
      </svg>`,
    );
    const laidOut = applyYogaLayout(doc);
    const group = laidOut.children[0];
    const first = group?.children[0];
    const second = group?.children[1];
    expect(first?.attributes.x).toBe('0');
    expect(second?.attributes.x).toBe('60');
    expect(doc.children[0]?.children[1]?.attributes.x).toBeUndefined();
  });

  it('honors flex-grow and padding', async () => {
    const doc = await parseDsvg(
      `<svg xmlns="http://www.w3.org/2000/svg" data-dsvg-version="0.1" width="200" height="40">
        <g data-dsvg-layout="flex" data-dsvg-padding="10" data-dsvg-width="200" data-dsvg-height="40">
          <rect width="20" height="20" data-dsvg-flex-grow="1" fill="#00f"/>
        </g>
      </svg>`,
    );
    const laidOut = applyYogaLayout(doc);
    const rect = laidOut.children[0]?.children[0];
    expect(Number(rect?.attributes.x)).toBe(10);
    expect(Number(rect?.attributes.width)).toBeGreaterThan(20);
  });

  it('composes transform ahead of existing transforms', async () => {
    const doc = await parseDsvg(
      `<svg xmlns="http://www.w3.org/2000/svg" data-dsvg-version="0.1" width="200" height="100">
        <g data-dsvg-layout="flex" data-dsvg-width="200" data-dsvg-height="100">
          <rect width="40" height="40" transform="rotate(15)" fill="#123"/>
        </g>
      </svg>`,
    );
    const laidOut = applyYogaLayout(doc);
    const transform = laidOut.children[0]?.children[0]?.attributes.transform ?? '';
    expect(transform.startsWith('translate(')).toBe(true);
    expect(transform.includes('rotate(15)')).toBe(true);
  });

  it('does not scale text that already has a transform', async () => {
    const doc = await parseDsvg(
      `<svg xmlns="http://www.w3.org/2000/svg" data-dsvg-version="0.1" width="200" height="100">
        <g data-dsvg-layout="flex" data-dsvg-width="200" data-dsvg-height="100">
          <text font-size="16" transform="rotate(5)" data-dsvg-width="80" data-dsvg-height="20">Hi</text>
        </g>
      </svg>`,
    );
    const laidOut = applyYogaLayout(doc, { textMeasurement: 'skip' });
    const text = laidOut.children[0]?.children[0];
    const transform = text?.attributes.transform ?? '';
    expect(transform.includes('scale(')).toBe(false);
    expect(transform.startsWith('translate(')).toBe(true);
    expect(transform.includes('rotate(5)')).toBe(true);
  });
});

describe('compile', () => {
  it('compiles template + layout and strips control attrs', async () => {
    const result = await compileDsvg(
      `<svg xmlns="http://www.w3.org/2000/svg" data-dsvg-version="0.1" width="200" height="80">
        <g data-dsvg-layout="flex" data-dsvg-gap="8" data-dsvg-width="200" data-dsvg-height="80">
          <text font-size="16">Hello {{name}}</text>
          <rect width="{{width}}" height="12" fill="#3366ff"/>
        </g>
      </svg>`,
      { variables: { name: 'Alice', width: 120 }, textMeasurement: 'skip' },
    );
    expect(result.svg).toContain('Hello Alice');
    expect(result.svg).toContain('width="120"');
    expect(result.svg).not.toContain('data-dsvg-');
    expect(result.svg).not.toContain('{{');
  });

  it('compiles example fixtures and matches golden outputs', async () => {
    const flexSource = readExample('flex-row.dsvg');
    const flexResult = await compileDsvg(flexSource);
    expect(flexResult.svg).toBe(readExample('flex-row.compiled.svg').trim());

    const templateSource = readExample('hello-template.dsvg');
    const templateResult = await compileDsvg(templateSource, {
      variables: { name: 'World', width: 80 },
    });
    expect(templateResult.svg).toBe(readExample('hello-template.compiled.svg').trim());

    const nestedSource = readExample('nested-flex.dsvg');
    const nestedResult = await compileDsvg(nestedSource);
    expect(nestedResult.svg).toBe(readExample('nested-flex.compiled.svg').trim());

    const fallbackSafe = readExample('hello-template.d.svg');
    const fallbackResult = await compileDsvg(fallbackSafe);
    expect(fallbackResult.svg).toContain('Hello World');
  });

  it('rejects the invalid mustache example fixture', async () => {
    await expect(compileDsvg(readExample('invalid-mustache-section.dsvg'))).rejects.toBeInstanceOf(
      DsvgCompileError,
    );
  });

  it('requires fonts for flex-text-row unless measurement is skipped', async () => {
    await expect(compileDsvg(readExample('flex-text-row.dsvg'))).rejects.toBeInstanceOf(
      DsvgCompileError,
    );
    const skipped = await compileDsvg(readExample('flex-text-row.dsvg'), {
      textMeasurement: 'skip',
    });
    expect(skipped.svg).toContain('Hello DSVG');
    expect(skipped.svg).not.toContain('data-dsvg-');
  });

  it('supports compileDsvgDocument and stripDsvgAttributes:false', async () => {
    const doc = await parseDsvg(
      `<svg xmlns="http://www.w3.org/2000/svg" data-dsvg-version="0.1" width="40" height="40">
        <g data-dsvg-layout="flex" data-dsvg-width="40" data-dsvg-height="40">
          <rect width="10" height="10"/>
        </g>
      </svg>`,
    );
    const result = await compileDsvgDocument(doc, { stripDsvgAttributes: false });
    expect(result.svg).toContain('data-dsvg-layout="flex"');
  });

  it('is deterministic', async () => {
    const source = readExample('flex-row.dsvg');
    const a = await compileDsvg(source);
    const b = await compileDsvg(source);
    expect(a.svg).toBe(b.svg);
  });
});
