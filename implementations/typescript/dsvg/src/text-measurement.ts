import opentype, { type Font as OpenTypeFont } from '@shuding/opentype.js';

import { parseFiniteNumber } from './attributes.js';
import { DsvgCompileError, createError } from './errors.js';
import type { DsvgNode, FontOptions, FontStyle, FontWeight, TextMeasurementMode } from './types.js';

type ParsedFont = {
  font: OpenTypeFont;
  name: string;
  weight: number;
  style: FontStyle;
};

export type TextMetrics = {
  width: number;
  height: number;
  /** Distance from the top of the text box to the alphabetic baseline. */
  baseline: number;
};

export type TextMeasurer = {
  /**
   * Measures a `<text>` node using loaded OpenType fonts.
   * @param node - Text element to measure.
   * @param path - Optional AST path for diagnostics.
   * @returns Width, height, and baseline in SVG user units.
   */
  measure: (node: DsvgNode, path?: string) => TextMetrics;
};

const parsedFontCache = new WeakMap<ArrayBuffer | Uint8Array, OpenTypeFont>();

/**
 * Normalizes CSS/SVG font-weight keywords into numeric weights.
 * @param weight - Raw weight value.
 * @returns Numeric weight.
 */
const normalizeWeight = (weight: FontWeight | string | undefined): number => {
  if (weight === 'normal' || weight === undefined) {
    return 400;
  }
  if (weight === 'bold') {
    return 700;
  }
  const numeric = typeof weight === 'number' ? weight : Number(weight);
  return Number.isFinite(numeric) ? numeric : 400;
};

/**
 * Normalizes CSS/SVG font-style values.
 * @param style - Raw style value.
 * @returns `normal` or `italic`.
 */
const normalizeStyle = (style: FontStyle | string | undefined): FontStyle =>
  style === 'italic' || style === 'oblique' ? 'italic' : 'normal';

/**
 * Parses font-size into SVG user units, defaulting to 16.
 * @param value - Raw `font-size` attribute.
 * @returns Font size in user units.
 */
export const parseFontSize = (value: string | undefined): number => {
  if (value === undefined || value.trim() === '') {
    return 16;
  }
  const numeric = parseFiniteNumber(value.replace(/px$/i, '').trim());
  return numeric !== undefined && numeric > 0 ? numeric : 16;
};

/**
 * Normalizes SVG text whitespace for single-line flex measurement.
 * Converts newlines/tabs to spaces, collapses runs, and trims ends.
 * @param value - Raw concatenated text.
 * @returns Normalized single-line string.
 */
export const normalizeTextContent = (value: string): string =>
  value
    .replace(/[\t\n\r\f]+/g, ' ')
    .replace(/ {2,}/g, ' ')
    .trim();

/**
 * Collects concatenated text content from a `<text>` subtree.
 * @param node - Text element.
 * @param options - Collection options.
 * @returns Flattened text string.
 */
export const collectTextContent = (
  node: DsvgNode,
  options: { normalize?: boolean } = {},
): string => {
  const parts: string[] = [];
  /**
   * Walks a text subtree and accumulates string leaves.
   * @param current - Current node in the walk.
   * @returns Nothing.
   */
  const walk = (current: DsvgNode): void => {
    if (current.type === 'text') {
      parts.push(current.value ?? '');
      return;
    }
    for (const child of current.children) {
      walk(child);
    }
  };
  walk(node);
  const joined = parts.join('');
  return options.normalize === false ? joined : normalizeTextContent(joined);
};

/**
 * Rewrites a `<text>` subtree to a single normalized text leaf.
 * @param node - Text element to normalize in place.
 * @returns Normalized string stored on the node.
 */
export const normalizeTextElementContent = (node: DsvgNode): string => {
  const normalized = collectTextContent(node);
  node.children = [
    {
      name: '',
      type: 'text',
      value: normalized,
      attributes: {},
      children: [],
    },
  ];
  return normalized;
};

/**
 * Splits a `font-family` attribute into ordered family names.
 * @param value - Raw SVG font-family attribute.
 * @returns Family names without quotes.
 */
export const parseFontFamilies = (value: string | undefined): string[] => {
  if (value === undefined || value.trim() === '') {
    return [];
  }
  return value
    .split(',')
    .map((part) => part.trim().replace(/^['"]|['"]$/g, ''))
    .filter((part) => part.length > 0);
};

/**
 * Parses and caches an OpenType font buffer.
 * @param data - Font bytes.
 * @returns Parsed font.
 */
const parseFontData = (data: ArrayBuffer | Uint8Array): OpenTypeFont => {
  const cached = parsedFontCache.get(data);
  if (cached) {
    return cached;
  }
  const buffer =
    data instanceof ArrayBuffer
      ? data
      : data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  try {
    const font = opentype.parse(buffer);
    parsedFontCache.set(data, font);
    return font;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new DsvgCompileError([
      createError('TEXT_MEASUREMENT_FAILED', `Failed to parse font data: ${message}`),
    ]);
  }
};

/**
 * Scores how closely a loaded font matches a requested weight/style.
 * Lower is better.
 * @param requestedWeight - Desired weight.
 * @param requestedStyle - Desired style.
 * @param candidate - Candidate font.
 * @returns Match score.
 */
const scoreFontMatch = (
  requestedWeight: number,
  requestedStyle: FontStyle,
  candidate: ParsedFont,
): number => {
  let score = Math.abs(candidate.weight - requestedWeight);
  if (candidate.style !== requestedStyle) {
    score += 1000;
  }
  return score;
};

/**
 * Creates a deterministic OpenType text measurer from supplied fonts.
 * @param fonts - Font resources to load.
 * @returns Measurer instance.
 */
export const createFontMeasurer = (fonts: FontOptions[]): TextMeasurer => {
  if (fonts.length === 0) {
    throw new DsvgCompileError([
      createError(
        'TEXT_MEASUREMENT_REQUIRED',
        'Intrinsic text measurement requires at least one font in options.fonts',
      ),
    ]);
  }

  const loaded: ParsedFont[] = fonts.map((fontOption) => ({
    font: parseFontData(fontOption.data),
    name: fontOption.name.toLowerCase(),
    weight: normalizeWeight(fontOption.weight),
    style: normalizeStyle(fontOption.style),
  }));

  const widthCache = new Map<string, number>();

  /**
   * Resolves the best loaded font for a text node.
   * @param node - Text element.
   * @param path - Optional AST path for diagnostics.
   * @returns Matching parsed font.
   */
  const resolveFont = (node: DsvgNode, path?: string): ParsedFont => {
    const families = parseFontFamilies(node.attributes['font-family']).map((name) =>
      name.toLowerCase(),
    );
    const requestedWeight = normalizeWeight(node.attributes['font-weight']);
    const requestedStyle = normalizeStyle(node.attributes['font-style']);

    const candidates =
      families.length === 0 ? loaded : loaded.filter((font) => families.includes(font.name));

    if (candidates.length === 0) {
      throw new DsvgCompileError([
        createError(
          'TEXT_MEASUREMENT_REQUIRED',
          `No loaded font matches font-family "${node.attributes['font-family'] ?? ''}"`,
          path,
        ),
      ]);
    }

    let best = candidates[0]!;
    let bestScore = scoreFontMatch(requestedWeight, requestedStyle, best);
    for (let i = 1; i < candidates.length; i += 1) {
      const candidate = candidates[i]!;
      const score = scoreFontMatch(requestedWeight, requestedStyle, candidate);
      if (score < bestScore) {
        best = candidate;
        bestScore = score;
      }
    }
    return best;
  };

  return {
    /**
     * Measures a `<text>` node using loaded OpenType fonts.
     * @param node - Text element to measure.
     * @param path - Optional AST path for diagnostics.
     * @returns Width, height, and baseline in SVG user units.
     */
    measure: (node: DsvgNode, path?: string): TextMetrics => {
      const text = collectTextContent(node);
      const fontSize = parseFontSize(node.attributes['font-size']);
      const letterSpacing =
        parseFiniteNumber((node.attributes['letter-spacing'] ?? '').replace(/px$/i, '')) ?? 0;
      const resolved = resolveFont(node, path);
      const cacheKey = `${resolved.name}|${resolved.weight}|${resolved.style}|${fontSize}|${letterSpacing}|${text}`;

      let measuredWidth = widthCache.get(cacheKey);
      if (measuredWidth === undefined) {
        let width: number;
        try {
          width = resolved.font.getAdvanceWidth(text, fontSize, {
            letterSpacing: fontSize === 0 ? 0 : letterSpacing / fontSize,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          throw new DsvgCompileError([
            createError(
              'TEXT_MEASUREMENT_FAILED',
              `Failed to measure text "${text}": ${message}`,
              path,
            ),
          ]);
        }
        if (!Number.isFinite(width) || width < 0) {
          throw new DsvgCompileError([
            createError(
              'TEXT_MEASUREMENT_FAILED',
              `Font measurement returned invalid width for "${text}"`,
              path,
            ),
          ]);
        }
        measuredWidth = width;
        widthCache.set(cacheKey, measuredWidth);
      }

      const unitsPerEm = resolved.font.unitsPerEm || 1000;
      const ascender = (resolved.font.ascender / unitsPerEm) * fontSize;
      const descender = (resolved.font.descender / unitsPerEm) * fontSize;
      const height = ascender - descender;

      if (!Number.isFinite(height) || height <= 0) {
        throw new DsvgCompileError([
          createError(
            'TEXT_MEASUREMENT_FAILED',
            `Font measurement returned invalid height for "${text}"`,
            path,
          ),
        ]);
      }

      return {
        width: measuredWidth,
        height,
        baseline: ascender,
      };
    },
  };
};

/**
 * Returns whether a node is an element-level `<text>` node.
 * @param node - Candidate node.
 * @returns True for SVG text elements.
 */
export const isTextElement = (node: DsvgNode): boolean =>
  node.type !== 'text' && node.name === 'text';

/**
 * Resolves whether intrinsic font measurement is active.
 * @param mode - Requested measurement mode.
 * @returns True when OpenType measurement should run.
 */
export const shouldMeasureTextWithFonts = (mode: TextMeasurementMode | undefined): boolean =>
  mode !== 'skip';
