import { parse } from 'svgson';

import { DsvgCompileError, createError } from './errors.js';
import type { DsvgDocument, DsvgNode } from './types.js';

type SvgsonLike = {
  name: string;
  type: string;
  value?: string;
  attributes?: Record<string, string>;
  children?: SvgsonLike[];
};

const XML_PROLOG_PATTERN = /^\s*(?:<\?xml\b[^?]*\?>\s*)?(?:<!DOCTYPE\b[^>]*>\s*)?/i;

/**
 * XML-escapes a string for safe attribute values.
 * @param value - Unescaped string.
 * @returns Escaped string.
 */
const escapeXmlAttr = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');

/**
 * XML-escapes a string for safe text content (never CDATA).
 * @param value - Unescaped string.
 * @returns Escaped string.
 */
const escapeXmlText = (value: string): string =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

/**
 * Normalizes an svgson node into the DSVG AST shape.
 * @param node - Raw svgson-like node.
 * @returns Normalized DSVG node.
 */
export const normalizeNode = (node: SvgsonLike): DsvgNode => {
  return {
    name: node.name,
    type: node.type,
    value: node.value ?? '',
    attributes: { ...(node.attributes ?? {}) },
    children: (node.children ?? []).map((child) => normalizeNode(child)),
  };
};

/**
 * Strips an optional XML declaration and DOCTYPE before root detection.
 * @param source - Raw XML source.
 * @returns Source without prolog, trimmed.
 */
const stripXmlProlog = (source: string): string => source.replace(XML_PROLOG_PATTERN, '').trim();

/**
 * Parses a DSVG XML string into a document AST.
 * @param source - Raw XML source.
 * @returns Parsed DSVG document.
 */
export const parseDsvg = async (source: string): Promise<DsvgDocument> => {
  const trimmed = stripXmlProlog(source);
  if (!trimmed.toLowerCase().startsWith('<svg')) {
    throw new DsvgCompileError([
      createError('INVALID_ROOT', 'DSVG documents must start with an <svg> root element'),
    ]);
  }

  try {
    const parsed = await parse(trimmed, { camelcase: false });
    const document = normalizeNode(parsed) as DsvgDocument;
    if (document.name !== 'svg') {
      throw new DsvgCompileError([
        createError('INVALID_ROOT', `Expected root <svg>, received <${document.name}>`),
      ]);
    }
    return document;
  } catch (error) {
    if (error instanceof DsvgCompileError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new DsvgCompileError([createError('PARSE_ERROR', `Failed to parse DSVG: ${message}`)]);
  }
};

/**
 * Serializes a DSVG node to XML without CDATA wrapping or double-escaping.
 * Attribute and text values are written as already-final XML character data:
 * template escaping and the XML parser own entity encoding.
 * @param node - Node to serialize.
 * @returns XML string.
 */
const serializeNode = (node: DsvgNode): string => {
  if (node.type === 'text' || node.name === '') {
    return node.value ?? '';
  }

  const attrs = Object.entries(node.attributes)
    .map(([name, value]) => ` ${name}="${value}"`)
    .join('');
  const children = node.children.map((child) => serializeNode(child)).join('');
  if (children.length === 0) {
    return `<${node.name}${attrs}/>`;
  }
  return `<${node.name}${attrs}>${children}</${node.name}>`;
};

/**
 * Serializes a DSVG document AST to an XML string.
 * @param document - Document to serialize.
 * @returns XML string.
 */
export const serializeDsvg = (document: DsvgDocument): string => serializeNode(document);

/**
 * Parses an XML fragment into DSVG nodes (for raw Mustache injection).
 * @param fragment - Raw XML fragment.
 * @returns Normalized child nodes.
 */
export const parseXmlFragment = async (fragment: string): Promise<DsvgNode[]> => {
  const wrapped = await parse(`<svg>${fragment}</svg>`, { camelcase: false });
  return (wrapped.children ?? []).map((child) => normalizeNode(child));
};

export { escapeXmlAttr, escapeXmlText };
