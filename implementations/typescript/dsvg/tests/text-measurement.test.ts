import { describe, expect, it } from 'vitest';

import {
  DsvgCompileError,
  applyYogaLayout,
  collectTextContent,
  compileDsvg,
  createFontMeasurer,
  parseDsvg,
  parseFontFamilies,
  parseFontSize,
} from '../src/index.js';
import { createTestFontData } from './create-test-font.js';

const testFont = {
  name: 'TestFont',
  data: createTestFontData('TestFont'),
  weight: 400 as const,
  style: 'normal' as const,
};

const boldFont = {
  name: 'TestFont',
  data: createTestFontData('TestFont', 700),
  weight: 700 as const,
  style: 'normal' as const,
};

describe('text measurement helpers', () => {
  it('parses font size and families', () => {
    expect(parseFontSize(undefined)).toBe(16);
    expect(parseFontSize('30px')).toBe(30);
    expect(parseFontFamilies(`"TestFont", system-ui`)).toEqual(['TestFont', 'system-ui']);
  });

  it('collects text content from nested nodes', async () => {
    const doc = await parseDsvg(
      `<svg xmlns="http://www.w3.org/2000/svg" data-dsvg-version="0.1" width="1" height="1">
        <text>Hello <tspan>World</tspan></text>
      </svg>`,
    );
    const text = doc.children.find((child) => child.name === 'text');
    expect(text).toBeDefined();
    expect(collectTextContent(text!)).toBe('Hello World');
  });

  it('normalizes indented text before flex layout', async () => {
    const result = await compileDsvg(
      `<svg xmlns="http://www.w3.org/2000/svg" data-dsvg-version="0.1" width="400" height="100">
        <g data-dsvg-layout="flex" data-dsvg-justify-content="center" data-dsvg-align-items="center" data-dsvg-width="400" data-dsvg-height="100">
          <text font-family="TestFont" font-size="20">
            {{title}}
          </text>
        </g>
      </svg>`,
      { fonts: [testFont], variables: { title: 'Hi' } },
    );
    const text = result.document.children[0]?.children.find((child) => child.name === 'text');
    expect(collectTextContent(text!, { normalize: false })).toBe('Hi');
    expect(Number(text?.attributes.x)).toBeGreaterThan(100);
    expect(Number(text?.attributes.x)).toBeLessThan(200);
  });

  it('measures advance width with OpenType fonts', () => {
    const measurer = createFontMeasurer([testFont]);
    const metrics = measurer.measure({
      name: 'text',
      type: 'element',
      attributes: {
        'font-family': 'TestFont',
        'font-size': '20',
      },
      children: [{ name: '', type: 'text', value: 'Hi', attributes: {}, children: [] }],
    });
    expect(metrics.width).toBeGreaterThan(0);
    expect(metrics.height).toBe(20);
    expect(metrics.baseline).toBe(16);
  });
});

describe('flex text layout', () => {
  it('centers text using measured width', async () => {
    const result = await compileDsvg(
      `<svg xmlns="http://www.w3.org/2000/svg" data-dsvg-version="0.1" width="400" height="100">
          <g data-dsvg-layout="flex" data-dsvg-justify-content="center" data-dsvg-align-items="center" data-dsvg-width="400" data-dsvg-height="100">
            <text font-family="TestFont" font-size="20">Hi</text>
          </g>
        </svg>`,
      { fonts: [testFont] },
    );
    const text = result.document.children[0]?.children.find((child) => child.name === 'text');
    expect(text).toBeDefined();
    const x = Number(text?.attributes.x);
    const y = Number(text?.attributes.y);
    expect(x).toBeGreaterThan(100);
    expect(x).toBeLessThan(200);
    expect(y).toBeGreaterThan(40);
    expect(y).toBeLessThan(70);
  });

  it('measures templated text after variable resolution', async () => {
    const result = await compileDsvg(
      `<svg xmlns="http://www.w3.org/2000/svg" data-dsvg-version="0.1" width="500" height="100">
        <g data-dsvg-layout="flex" data-dsvg-justify-content="center" data-dsvg-width="500" data-dsvg-height="100" data-dsvg-align-items="center" data-dsvg-gap="20">
          <circle r="20" fill="#3366ff"/>
          <text font-family="TestFont" font-size="20" font-weight="700">{{title}}</text>
        </g>
      </svg>`,
      {
        fonts: [testFont, boldFont],
        variables: { title: 'Hello' },
      },
    );
    const group = result.document.children[0];
    const circle = group?.children.find((child) => child.name === 'circle');
    const text = group?.children.find((child) => child.name === 'text');
    expect(Number(circle?.attributes.cx)).toBeGreaterThan(100);
    expect(Number(text?.attributes.x)).toBeGreaterThan(Number(circle?.attributes.cx));
    expect(result.svg).toContain('Hello');
  });

  it('honors explicit data-dsvg dimensions over measured size', async () => {
    const result = await compileDsvg(
      `<svg xmlns="http://www.w3.org/2000/svg" data-dsvg-version="0.1" width="300" height="80">
        <g data-dsvg-layout="flex" data-dsvg-width="300" data-dsvg-height="80">
          <text font-family="TestFont" font-size="20" data-dsvg-width="120" data-dsvg-height="40">Hi</text>
        </g>
      </svg>`,
      { fonts: [testFont] },
    );
    const text = result.document.children[0]?.children.find((child) => child.name === 'text');
    expect(Number(text?.attributes.x)).toBe(0);
    expect(Number(text?.attributes.y)).toBeCloseTo(16, 5);
  });

  it('skips intrinsic measurement when requested', async () => {
    const doc = await parseDsvg(
      `<svg xmlns="http://www.w3.org/2000/svg" data-dsvg-version="0.1" width="200" height="80">
        <g data-dsvg-layout="flex" data-dsvg-justify-content="center" data-dsvg-width="200" data-dsvg-height="80">
          <text font-family="TestFont" font-size="20">Hi</text>
        </g>
      </svg>`,
    );
    const laidOut = applyYogaLayout(doc, { textMeasurement: 'skip' });
    const text = laidOut.children[0]?.children.find((child) => child.name === 'text');
    expect(Number(text?.attributes.x)).toBe(100);
  });

  it('errors when fonts are required but missing', async () => {
    await expect(
      compileDsvg(
        `<svg xmlns="http://www.w3.org/2000/svg" data-dsvg-version="0.1" width="200" height="80">
          <g data-dsvg-layout="flex" data-dsvg-width="200" data-dsvg-height="80">
            <text font-family="TestFont" font-size="20">Hi</text>
          </g>
        </svg>`,
      ),
    ).rejects.toBeInstanceOf(DsvgCompileError);

    try {
      await compileDsvg(
        `<svg xmlns="http://www.w3.org/2000/svg" data-dsvg-version="0.1" width="200" height="80">
          <g data-dsvg-layout="flex" data-dsvg-width="200" data-dsvg-height="80">
            <text font-family="Missing" font-size="20">Hi</text>
          </g>
        </svg>`,
        { fonts: [testFont] },
      );
      expect.unreachable('expected missing font error');
    } catch (error) {
      expect(error).toBeInstanceOf(DsvgCompileError);
      if (error instanceof DsvgCompileError) {
        expect(error.errors.some((item) => item.code === 'TEXT_MEASUREMENT_REQUIRED')).toBe(true);
      }
    }
  });
});
