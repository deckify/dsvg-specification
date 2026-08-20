import { cloneDocument } from './clone.js';
import { DsvgCompileError } from './errors.js';
import { resolveTrimRect } from './print-meta.js';
import type { DsvgDocument, DsvgNode } from './types.js';

const PREVIEW_CLIP_ID = 'dsvg-preview-clip';

/**
 * Formats a number for SVG attribute serialization.
 * @param value - Numeric value.
 * @returns Compact string form.
 */
const formatNumber = (value: number): string => {
  if (Number.isInteger(value)) {
    return String(value);
  }
  return String(Number(value.toFixed(6)));
};

/**
 * Crops a compiled document to the trim rectangle and optionally clips corners.
 * @param document - Post-layout document (bleed-box artboard).
 * @returns Cloned preview document in trim user space.
 */
export const applyPreviewOutput = (document: DsvgDocument): DsvgDocument => {
  const mapped = resolveTrimRect(document);
  if (!mapped.ok) {
    throw new DsvgCompileError([mapped.error]);
  }

  const { rect } = mapped;
  const cloned = cloneDocument(document);
  const contentChildren = cloned.children;

  const translated: DsvgNode = {
    name: 'g',
    type: 'element',
    attributes: {
      transform: `translate(${formatNumber(-rect.x)}, ${formatNumber(-rect.y)})`,
    },
    children: contentChildren,
  };

  if (rect.cornerRadius > 0) {
    const clipPath: DsvgNode = {
      name: 'clipPath',
      type: 'element',
      attributes: { id: PREVIEW_CLIP_ID },
      children: [
        {
          name: 'rect',
          type: 'element',
          attributes: {
            width: formatNumber(rect.width),
            height: formatNumber(rect.height),
            rx: formatNumber(rect.cornerRadius),
            ry: formatNumber(rect.cornerRadius),
          },
          children: [],
        },
      ],
    };
    const defs: DsvgNode = {
      name: 'defs',
      type: 'element',
      attributes: {},
      children: [clipPath],
    };
    const clipped: DsvgNode = {
      name: 'g',
      type: 'element',
      attributes: {
        'clip-path': `url(#${PREVIEW_CLIP_ID})`,
      },
      children: [translated],
    };
    cloned.children = [defs, clipped];
  } else {
    cloned.children = [translated];
  }

  cloned.attributes.width = formatNumber(rect.width);
  cloned.attributes.height = formatNumber(rect.height);
  cloned.attributes.viewBox = `0 0 ${formatNumber(rect.width)} ${formatNumber(rect.height)}`;

  return cloned;
};
