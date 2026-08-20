import { PRINT_META_ATTR_SET } from './attributes.js';
import { cloneDocument } from './clone.js';
import type { DsvgDocument, DsvgNode } from './types.js';
import { DSVG_ATTR_PREFIX } from './types.js';

export type StripDsvgAttributesOptions = {
  /** When true, preserve §4.4 print metadata attributes. Default: false */
  keepMeta?: boolean;
};

/**
 * Removes DSVG control attributes from a node tree in place.
 * @param node - Node to strip.
 * @param keepMeta - When true, preserve print metadata attributes.
 * @returns Nothing.
 */
const stripNode = (node: DsvgNode, keepMeta: boolean): void => {
  for (const key of Object.keys(node.attributes)) {
    if (!key.startsWith(DSVG_ATTR_PREFIX)) {
      continue;
    }
    if (keepMeta && PRINT_META_ATTR_SET.has(key)) {
      continue;
    }
    delete node.attributes[key];
  }
  for (const child of node.children) {
    stripNode(child, keepMeta);
  }
};

/**
 * Returns a cloned document with DSVG control attributes removed.
 * @param document - Source document.
 * @param options - Strip options.
 * @returns Cloned document without stripped `data-dsvg-*` attributes.
 */
export const stripDsvgAttributes = (
  document: DsvgDocument,
  options: StripDsvgAttributesOptions = {},
): DsvgDocument => {
  const cloned = cloneDocument(document);
  stripNode(cloned, options.keepMeta === true);
  return cloned;
};
