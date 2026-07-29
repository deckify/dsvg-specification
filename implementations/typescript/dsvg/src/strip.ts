import { cloneDocument } from './clone.js';
import type { DsvgDocument, DsvgNode } from './types.js';
import { DSVG_ATTR_PREFIX } from './types.js';

/**
 * Removes all `data-dsvg-*` attributes from a node tree in place.
 * @param node - Node to strip.
 * @returns Nothing.
 */
const stripNode = (node: DsvgNode): void => {
  for (const key of Object.keys(node.attributes)) {
    if (key.startsWith(DSVG_ATTR_PREFIX)) {
      delete node.attributes[key];
    }
  }
  for (const child of node.children) {
    stripNode(child);
  }
};

/**
 * Returns a cloned document with all DSVG control attributes removed.
 * @param document - Source document.
 * @returns Cloned document without `data-dsvg-*` attributes.
 */
export const stripDsvgAttributes = (document: DsvgDocument): DsvgDocument => {
  const cloned = cloneDocument(document);
  stripNode(cloned);
  return cloned;
};
