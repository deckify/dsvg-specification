import type { DsvgDocument, DsvgNode } from './types.js';

/**
 * Deep-clones a DSVG AST node, including attributes and children.
 * @param node - Node to clone.
 * @returns Independent deep copy of the node.
 */
export const cloneNode = <T extends DsvgNode>(node: T): T => {
  return {
    ...node,
    attributes: { ...node.attributes },
    children: node.children.map((child) => cloneNode(child)),
  };
};

/**
 * Deep-clones a DSVG document root.
 * @param document - Document to clone.
 * @returns Independent deep copy of the document.
 */
export const cloneDocument = (document: DsvgDocument): DsvgDocument => {
  return cloneNode(document) as DsvgDocument;
};
