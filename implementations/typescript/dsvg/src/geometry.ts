import { CHILD_LAYOUT_ATTRS, CONTAINER_LAYOUT_ATTRS, parseFiniteNumber } from './attributes.js';
import type { TextMeasurer, TextMetrics } from './text-measurement.js';
import { isTextElement } from './text-measurement.js';
import type { DsvgNode } from './types.js';

export type BoxSize = {
  width: number;
  height: number;
};

export type MeasureContext = {
  /** OpenType measurer used for intrinsic `<text>` sizing. */
  textMeasurer?: TextMeasurer;
  /** When true, skip OpenType measurement and keep legacy `0 × 0` fallback. */
  skipTextMeasurement?: boolean;
  /** Optional AST path for diagnostics. */
  path?: string;
};

/**
 * Measures a node's layout box from DSVG and native SVG attributes.
 * @param node - Node to measure.
 * @param context - Optional text measurement context.
 * @returns Width and height in SVG user units.
 */
export const measureNode = (node: DsvgNode, context: MeasureContext = {}): BoxSize => {
  const explicitWidth = parseFiniteNumber(node.attributes[CHILD_LAYOUT_ATTRS.width] ?? '');
  const explicitHeight = parseFiniteNumber(node.attributes[CHILD_LAYOUT_ATTRS.height] ?? '');

  if (explicitWidth !== undefined && explicitHeight !== undefined) {
    return { width: explicitWidth, height: explicitHeight };
  }

  if (isTextElement(node)) {
    if (context.skipTextMeasurement || !context.textMeasurer) {
      return {
        width: explicitWidth ?? 0,
        height: explicitHeight ?? 0,
      };
    }
    const metrics = context.textMeasurer.measure(node, context.path);
    return {
      width: explicitWidth ?? metrics.width,
      height: explicitHeight ?? metrics.height,
    };
  }

  let width = explicitWidth ?? 0;
  let height = explicitHeight ?? 0;

  switch (node.name) {
    case 'rect':
    case 'image':
    case 'svg': {
      width = explicitWidth ?? parseFiniteNumber(node.attributes.width ?? '') ?? 0;
      height = explicitHeight ?? parseFiniteNumber(node.attributes.height ?? '') ?? 0;
      break;
    }
    case 'ellipse': {
      const rx = parseFiniteNumber(node.attributes.rx ?? '') ?? 0;
      const ry = parseFiniteNumber(node.attributes.ry ?? '') ?? 0;
      width = explicitWidth ?? rx * 2;
      height = explicitHeight ?? ry * 2;
      break;
    }
    case 'circle': {
      const r = parseFiniteNumber(node.attributes.r ?? '') ?? 0;
      width = explicitWidth ?? r * 2;
      height = explicitHeight ?? r * 2;
      break;
    }
    case 'g': {
      width =
        explicitWidth ??
        parseFiniteNumber(node.attributes[CONTAINER_LAYOUT_ATTRS.width] ?? '') ??
        parseFiniteNumber(node.attributes.width ?? '') ??
        0;
      height =
        explicitHeight ??
        parseFiniteNumber(node.attributes[CONTAINER_LAYOUT_ATTRS.height] ?? '') ??
        parseFiniteNumber(node.attributes.height ?? '') ??
        0;
      break;
    }
    default: {
      width = explicitWidth ?? parseFiniteNumber(node.attributes.width ?? '') ?? 0;
      height = explicitHeight ?? parseFiniteNumber(node.attributes.height ?? '') ?? 0;
    }
  }

  return { width, height };
};

/**
 * Resolves a flex container's size from DSVG attrs, native attrs, or fallback.
 * @param group - Flex group node.
 * @param fallback - Fallback size when attributes are absent.
 * @returns Container width and height.
 */
export const getContainerSize = (group: DsvgNode, fallback: BoxSize): BoxSize => {
  const width =
    parseFiniteNumber(group.attributes[CONTAINER_LAYOUT_ATTRS.width] ?? '') ??
    parseFiniteNumber(group.attributes.width ?? '') ??
    fallback.width;
  const height =
    parseFiniteNumber(group.attributes[CONTAINER_LAYOUT_ATTRS.height] ?? '') ??
    parseFiniteNumber(group.attributes.height ?? '') ??
    fallback.height;
  return { width, height };
};

/**
 * Applies Yoga-computed layout to a node via native geometry or transform composition.
 * @param node - Child node receiving layout.
 * @param left - Computed left offset.
 * @param top - Computed top offset.
 * @param computedWidth - Computed width.
 * @param computedHeight - Computed height.
 * @param measured - Pre-layout measured size.
 * @param textMetrics - Optional text metrics including baseline.
 * @returns Nothing.
 */
export const applyLayoutToNode = (
  node: DsvgNode,
  left: number,
  top: number,
  computedWidth: number,
  computedHeight: number,
  measured: BoxSize,
  textMetrics?: TextMetrics,
): void => {
  const sx = measured.width === 0 ? 1 : computedWidth / measured.width;
  const sy = measured.height === 0 ? 1 : computedHeight / measured.height;
  const needsScale = Math.abs(sx - 1) > 1e-9 || Math.abs(sy - 1) > 1e-9;
  const existing = node.attributes.transform?.trim();

  // Prefer native geometry updates for simple shapes without a prior transform.
  if (!existing && (node.name === 'rect' || node.name === 'image' || node.name === 'svg')) {
    node.attributes.x = String(left);
    node.attributes.y = String(top);
    node.attributes.width = String(computedWidth);
    node.attributes.height = String(computedHeight);
    return;
  }

  if (!existing && node.name === 'ellipse') {
    node.attributes.cx = String(left + computedWidth / 2);
    node.attributes.cy = String(top + computedHeight / 2);
    node.attributes.rx = String(computedWidth / 2);
    node.attributes.ry = String(computedHeight / 2);
    return;
  }

  if (!existing && node.name === 'circle') {
    node.attributes.cx = String(left + computedWidth / 2);
    node.attributes.cy = String(top + computedHeight / 2);
    node.attributes.r = String(Math.min(computedWidth, computedHeight) / 2);
    return;
  }

  if (node.name === 'text') {
    const fontSize =
      parseFiniteNumber((node.attributes['font-size'] ?? '').replace(/px$/i, '')) ?? 16;
    const baseline = textMetrics?.baseline ?? fontSize * 0.8;
    // Spec §5.3: never scale glyph metrics via transform.
    if (!existing) {
      node.attributes.x = String(left);
      node.attributes.y = String(top + baseline);
      return;
    }
    node.attributes.x = '0';
    node.attributes.y = String(baseline);
    node.attributes.transform = `translate(${left} ${top}) ${existing}`;
    return;
  }

  // Zero origin for shapes that use absolute x/y/cx/cy, then translate via transform.
  if (!existing) {
    if (node.attributes.x !== undefined) {
      node.attributes.x = '0';
    }
    if (node.attributes.y !== undefined) {
      node.attributes.y = '0';
    }
    if (node.attributes.cx !== undefined) {
      node.attributes.cx = String(measured.width / 2);
    }
    if (node.attributes.cy !== undefined) {
      node.attributes.cy = String(measured.height / 2);
    }
    if (node.attributes.width !== undefined) {
      node.attributes.width = String(measured.width);
    }
    if (node.attributes.height !== undefined) {
      node.attributes.height = String(measured.height);
    }
  }

  const scalePart = needsScale ? ` scale(${sx} ${sy})` : '';
  const generated = `translate(${left} ${top})${scalePart}`;
  node.attributes.transform = existing ? `${generated} ${existing}` : generated;
};
