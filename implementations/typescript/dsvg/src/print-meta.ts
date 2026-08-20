import {
  DEFAULT_PRINT_UNITS,
  PRINT_META_ATTRS,
  PRINT_UNITS_VALUES,
  isOneOf,
  parseFiniteNumber,
} from './attributes.js';
import { createError } from './errors.js';
import type { DsvgDocument, DsvgError, EdgeInsets, PrintMeta, TrimRect } from './types.js';

/**
 * Returns whether any print metadata attribute is present on the root.
 * @param attributes - Root element attributes.
 * @returns True when at least one print metadata attribute exists.
 */
export const hasPrintMetaAttributes = (attributes: Record<string, string>): boolean => {
  return Object.values(PRINT_META_ATTRS).some((attr) => attributes[attr] !== undefined);
};

/**
 * Resolves uniform + per-side inset attributes into absolute edge values.
 * @param attributes - Attribute map to read.
 * @param uniformAttr - Uniform inset attribute name.
 * @param sideAttrs - Per-side attribute names.
 * @returns Resolved edge insets (default 0).
 */
const resolveEdges = (
  attributes: Record<string, string>,
  uniformAttr: string,
  sideAttrs: { top: string; right: string; bottom: string; left: string },
): EdgeInsets => {
  const uniform = parseFiniteNumber(attributes[uniformAttr] ?? '') ?? 0;
  return {
    top: parseFiniteNumber(attributes[sideAttrs.top] ?? '') ?? uniform,
    right: parseFiniteNumber(attributes[sideAttrs.right] ?? '') ?? uniform,
    bottom: parseFiniteNumber(attributes[sideAttrs.bottom] ?? '') ?? uniform,
    left: parseFiniteNumber(attributes[sideAttrs.left] ?? '') ?? uniform,
  };
};

/**
 * Reads and resolves print metadata from a DSVG document root.
 * @param document - Source document.
 * @returns Resolved print metadata, or undefined when no print attrs are present.
 */
export const readPrintMeta = (document: DsvgDocument): PrintMeta | undefined => {
  const { attributes } = document;
  if (!hasPrintMetaAttributes(attributes)) {
    return undefined;
  }

  const unitsRaw = attributes[PRINT_META_ATTRS.printUnits];
  const units =
    unitsRaw !== undefined && isOneOf(unitsRaw, PRINT_UNITS_VALUES)
      ? unitsRaw
      : DEFAULT_PRINT_UNITS;

  const trimWidth = parseFiniteNumber(attributes[PRINT_META_ATTRS.trimWidth] ?? '');
  const trimHeight = parseFiniteNumber(attributes[PRINT_META_ATTRS.trimHeight] ?? '');
  const cornerRadius = parseFiniteNumber(attributes[PRINT_META_ATTRS.cornerRadius] ?? '');
  const dpi = parseFiniteNumber(attributes[PRINT_META_ATTRS.dpi] ?? '');

  const meta: PrintMeta = {
    units,
    bleed: resolveEdges(attributes, PRINT_META_ATTRS.bleed, {
      top: PRINT_META_ATTRS.bleedTop,
      right: PRINT_META_ATTRS.bleedRight,
      bottom: PRINT_META_ATTRS.bleedBottom,
      left: PRINT_META_ATTRS.bleedLeft,
    }),
    safeArea: resolveEdges(attributes, PRINT_META_ATTRS.safeArea, {
      top: PRINT_META_ATTRS.safeAreaTop,
      right: PRINT_META_ATTRS.safeAreaRight,
      bottom: PRINT_META_ATTRS.safeAreaBottom,
      left: PRINT_META_ATTRS.safeAreaLeft,
    }),
  };

  if (trimWidth !== undefined && trimHeight !== undefined) {
    meta.trim = { width: trimWidth, height: trimHeight };
  }
  if (cornerRadius !== undefined) {
    meta.cornerRadius = cornerRadius;
  }
  if (dpi !== undefined) {
    meta.dpi = dpi;
  }

  return meta;
};

/**
 * Maps print-unit trim/bleed geometry into SVG user-space coordinates.
 * @param document - Document whose artboard size is used for scaling.
 * @returns Trim rectangle in user units, or a structured error when mapping fails.
 */
export const resolveTrimRect = (
  document: DsvgDocument,
): { ok: true; rect: TrimRect } | { ok: false; error: DsvgError } => {
  const meta = readPrintMeta(document);
  if (!meta?.trim) {
    return {
      ok: false,
      error: createError(
        'INVALID_PRINT_PREVIEW',
        'Preview output requires data-dsvg-trim-width and data-dsvg-trim-height',
        'svg',
      ),
    };
  }

  const svgWidth = parseFiniteNumber(document.attributes.width ?? '');
  const svgHeight = parseFiniteNumber(document.attributes.height ?? '');
  if (svgWidth === undefined || svgHeight === undefined || svgWidth <= 0 || svgHeight <= 0) {
    return {
      ok: false,
      error: createError(
        'INVALID_PRINT_PREVIEW',
        'Preview output requires finite positive root width and height',
        'svg',
      ),
    };
  }

  const bleedBoxW = meta.trim.width + meta.bleed.left + meta.bleed.right;
  const bleedBoxH = meta.trim.height + meta.bleed.top + meta.bleed.bottom;
  if (bleedBoxW <= 0 || bleedBoxH <= 0) {
    return {
      ok: false,
      error: createError(
        'INVALID_PRINT_PREVIEW',
        'Preview output requires a positive bleed-box size (trim + bleed)',
        'svg',
      ),
    };
  }

  const sx = svgWidth / bleedBoxW;
  const sy = svgHeight / bleedBoxH;
  const cornerRadius = (meta.cornerRadius ?? 0) * Math.min(sx, sy);

  return {
    ok: true,
    rect: {
      x: meta.bleed.left * sx,
      y: meta.bleed.top * sy,
      width: meta.trim.width * sx,
      height: meta.trim.height * sy,
      cornerRadius,
    },
  };
};
