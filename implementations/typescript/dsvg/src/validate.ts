import {
  ALIGN_CONTENT_VALUES,
  ALIGN_ITEMS_VALUES,
  ALIGN_SELF_VALUES,
  CHILD_LAYOUT_ATTRS,
  CONTAINER_LAYOUT_ATTRS,
  FLEX_DIRECTION_VALUES,
  FLEX_WRAP_VALUES,
  JUSTIFY_CONTENT_VALUES,
  isFiniteNumberString,
  isOneOf,
} from './attributes.js';
import { createError } from './errors.js';
import type { DsvgDocument, DsvgError, DsvgNode, ValidationResult } from './types.js';
import { DSVG_ATTR_PREFIX, DSVG_SPEC_VERSION } from './types.js';

const UNSUPPORTED_MUSTACHE = /\{\{\s*[#^/>]/;

const CONTAINER_ONLY_ATTRS = new Set<string>([
  CONTAINER_LAYOUT_ATTRS.layout,
  CONTAINER_LAYOUT_ATTRS.flexDirection,
  CONTAINER_LAYOUT_ATTRS.flexWrap,
  CONTAINER_LAYOUT_ATTRS.justifyContent,
  CONTAINER_LAYOUT_ATTRS.alignItems,
  CONTAINER_LAYOUT_ATTRS.alignContent,
  CONTAINER_LAYOUT_ATTRS.gap,
  CONTAINER_LAYOUT_ATTRS.rowGap,
  CONTAINER_LAYOUT_ATTRS.columnGap,
  CONTAINER_LAYOUT_ATTRS.padding,
  CONTAINER_LAYOUT_ATTRS.paddingTop,
  CONTAINER_LAYOUT_ATTRS.paddingRight,
  CONTAINER_LAYOUT_ATTRS.paddingBottom,
  CONTAINER_LAYOUT_ATTRS.paddingLeft,
]);

const CHILD_ONLY_ATTRS = new Set<string>([
  CHILD_LAYOUT_ATTRS.flexGrow,
  CHILD_LAYOUT_ATTRS.flexShrink,
  CHILD_LAYOUT_ATTRS.flexBasis,
  CHILD_LAYOUT_ATTRS.alignSelf,
]);

const KNOWN_LAYOUT_ATTRS = new Set<string>([
  ...CONTAINER_ONLY_ATTRS,
  ...CHILD_ONLY_ATTRS,
  CHILD_LAYOUT_ATTRS.width,
  CHILD_LAYOUT_ATTRS.height,
]);

/**
 * Joins AST path segments for diagnostics.
 * @param base - Parent path.
 * @param segment - Child segment.
 * @returns Combined path.
 */
const joinPath = (base: string, segment: string): string => (base ? `${base}/${segment}` : segment);

/**
 * Validates that an attribute value is one of the allowed keywords.
 * @param errors - Error accumulator.
 * @param path - AST path for diagnostics.
 * @param attr - Attribute name.
 * @param value - Attribute value, if present.
 * @param allowed - Allowed keyword list.
 * @returns Nothing.
 */
const validateKeyword = (
  errors: DsvgError[],
  path: string,
  attr: string,
  value: string | undefined,
  allowed: readonly string[],
): void => {
  if (value === undefined) {
    return;
  }
  if (!isOneOf(value, allowed)) {
    errors.push(
      createError(
        'INVALID_VALUE',
        `Invalid ${attr} value "${value}". Expected one of: ${allowed.join(', ')}`,
        path,
      ),
    );
  }
};

/**
 * Validates that an attribute value is a finite number (or optionally `auto`).
 * @param errors - Error accumulator.
 * @param path - AST path for diagnostics.
 * @param attr - Attribute name.
 * @param value - Attribute value, if present.
 * @param options - Extra constraints such as minimum or auto support.
 * @returns Nothing.
 */
const validateNumberAttr = (
  errors: DsvgError[],
  path: string,
  attr: string,
  value: string | undefined,
  options?: { allowAuto?: boolean; min?: number },
): void => {
  if (value === undefined) {
    return;
  }
  if (options?.allowAuto && value === 'auto') {
    return;
  }
  if (!isFiniteNumberString(value)) {
    errors.push(
      createError(
        'INVALID_VALUE',
        `Invalid ${attr} value "${value}". Expected a finite number`,
        path,
      ),
    );
    return;
  }
  const number = Number(value);
  if (options?.min !== undefined && number < options.min) {
    errors.push(
      createError(
        'INVALID_VALUE',
        `Invalid ${attr} value "${value}". Expected a number >= ${options.min}`,
        path,
      ),
    );
  }
};

/**
 * Rejects unsupported Mustache section/partial syntax on a string surface.
 * @param errors - Error accumulator.
 * @param path - AST path for diagnostics.
 * @param value - String surface to inspect.
 * @returns Nothing.
 */
const validateMustacheSurface = (errors: DsvgError[], path: string, value: string): void => {
  if (UNSUPPORTED_MUSTACHE.test(value)) {
    errors.push(
      createError(
        'UNSUPPORTED_MUSTACHE',
        'DSVG 0.1 supports variable interpolation only (no sections, partials, or lambdas)',
        path,
      ),
    );
  }
};

/**
 * Returns whether a node is a flex-enabled `<g>`.
 * @param node - Candidate node.
 * @returns True when the node opts into flex layout.
 */
const isFlexGroup = (node: DsvgNode): boolean =>
  node.name === 'g' && node.attributes[CONTAINER_LAYOUT_ATTRS.layout] === 'flex';

/**
 * Recursively validates a DSVG node and its descendants.
 * @param node - Node to validate.
 * @param path - AST path for diagnostics.
 * @param errors - Error accumulator.
 * @param parentIsFlex - Whether the parent is a flex `<g>`.
 * @returns Nothing.
 */
const validateNode = (
  node: DsvgNode,
  path: string,
  errors: DsvgError[],
  parentIsFlex: boolean,
): void => {
  if (node.type === 'text' || node.name === '') {
    if (node.value) {
      validateMustacheSurface(errors, path, node.value);
    }
    return;
  }

  const isFlex = isFlexGroup(node);

  for (const [attr, value] of Object.entries(node.attributes)) {
    validateMustacheSurface(errors, `${path}@${attr}`, value);

    if (!attr.startsWith(DSVG_ATTR_PREFIX)) {
      continue;
    }

    if (attr === `${DSVG_ATTR_PREFIX}version`) {
      continue;
    }

    if (!KNOWN_LAYOUT_ATTRS.has(attr)) {
      errors.push(
        createError('INVALID_ATTRIBUTE', `Unknown DSVG attribute "${attr}"`, `${path}@${attr}`),
      );
      continue;
    }

    if (CONTAINER_ONLY_ATTRS.has(attr) && !isFlex && attr !== CONTAINER_LAYOUT_ATTRS.layout) {
      errors.push(
        createError('INVALID_ATTRIBUTE', `${attr} is only valid on a flex <g>`, `${path}@${attr}`),
      );
    }

    if (CHILD_ONLY_ATTRS.has(attr) && !parentIsFlex) {
      errors.push(
        createError(
          'INVALID_ATTRIBUTE',
          `${attr} is only valid on direct children of a flex <g>`,
          `${path}@${attr}`,
        ),
      );
    }
  }

  if (node.attributes[CONTAINER_LAYOUT_ATTRS.layout] !== undefined) {
    if (node.name !== 'g') {
      errors.push(
        createError(
          'INVALID_ATTRIBUTE',
          `${CONTAINER_LAYOUT_ATTRS.layout} is only valid on <g>`,
          path,
        ),
      );
    } else if (node.attributes[CONTAINER_LAYOUT_ATTRS.layout] !== 'flex') {
      errors.push(
        createError(
          'INVALID_VALUE',
          `Invalid ${CONTAINER_LAYOUT_ATTRS.layout} value "${node.attributes[CONTAINER_LAYOUT_ATTRS.layout]}". Expected "flex"`,
          path,
        ),
      );
    }
  }

  if (isFlex) {
    validateKeyword(
      errors,
      path,
      CONTAINER_LAYOUT_ATTRS.flexDirection,
      node.attributes[CONTAINER_LAYOUT_ATTRS.flexDirection],
      FLEX_DIRECTION_VALUES,
    );
    validateKeyword(
      errors,
      path,
      CONTAINER_LAYOUT_ATTRS.flexWrap,
      node.attributes[CONTAINER_LAYOUT_ATTRS.flexWrap],
      FLEX_WRAP_VALUES,
    );
    validateKeyword(
      errors,
      path,
      CONTAINER_LAYOUT_ATTRS.justifyContent,
      node.attributes[CONTAINER_LAYOUT_ATTRS.justifyContent],
      JUSTIFY_CONTENT_VALUES,
    );
    validateKeyword(
      errors,
      path,
      CONTAINER_LAYOUT_ATTRS.alignItems,
      node.attributes[CONTAINER_LAYOUT_ATTRS.alignItems],
      ALIGN_ITEMS_VALUES,
    );
    validateKeyword(
      errors,
      path,
      CONTAINER_LAYOUT_ATTRS.alignContent,
      node.attributes[CONTAINER_LAYOUT_ATTRS.alignContent],
      ALIGN_CONTENT_VALUES,
    );

    for (const attr of [
      CONTAINER_LAYOUT_ATTRS.gap,
      CONTAINER_LAYOUT_ATTRS.rowGap,
      CONTAINER_LAYOUT_ATTRS.columnGap,
      CONTAINER_LAYOUT_ATTRS.padding,
      CONTAINER_LAYOUT_ATTRS.paddingTop,
      CONTAINER_LAYOUT_ATTRS.paddingRight,
      CONTAINER_LAYOUT_ATTRS.paddingBottom,
      CONTAINER_LAYOUT_ATTRS.paddingLeft,
      CONTAINER_LAYOUT_ATTRS.width,
      CONTAINER_LAYOUT_ATTRS.height,
    ]) {
      validateNumberAttr(errors, path, attr, node.attributes[attr]);
    }
  }

  if (parentIsFlex) {
    validateKeyword(
      errors,
      path,
      CHILD_LAYOUT_ATTRS.alignSelf,
      node.attributes[CHILD_LAYOUT_ATTRS.alignSelf],
      ALIGN_SELF_VALUES,
    );
    validateNumberAttr(
      errors,
      path,
      CHILD_LAYOUT_ATTRS.width,
      node.attributes[CHILD_LAYOUT_ATTRS.width],
    );
    validateNumberAttr(
      errors,
      path,
      CHILD_LAYOUT_ATTRS.height,
      node.attributes[CHILD_LAYOUT_ATTRS.height],
    );
    validateNumberAttr(
      errors,
      path,
      CHILD_LAYOUT_ATTRS.flexGrow,
      node.attributes[CHILD_LAYOUT_ATTRS.flexGrow],
      { min: 0 },
    );
    validateNumberAttr(
      errors,
      path,
      CHILD_LAYOUT_ATTRS.flexShrink,
      node.attributes[CHILD_LAYOUT_ATTRS.flexShrink],
      { min: 0 },
    );
    validateNumberAttr(
      errors,
      path,
      CHILD_LAYOUT_ATTRS.flexBasis,
      node.attributes[CHILD_LAYOUT_ATTRS.flexBasis],
      { allowAuto: true, min: 0 },
    );
  }

  node.children.forEach((child, index) => {
    const childPath =
      child.type === 'text' || child.name === ''
        ? joinPath(path, `text()[${index}]`)
        : joinPath(path, `${child.name}[${index}]`);
    validateNode(child, childPath, errors, isFlex);
  });
};

/**
 * Validates a DSVG document for version, attributes, and Mustache subset rules.
 * @param document - Document to validate.
 * @returns Success result or a collected error list.
 */
export const validateDsvg = (document: DsvgDocument): ValidationResult => {
  const errors: DsvgError[] = [];

  if (document.name !== 'svg') {
    errors.push(
      createError('INVALID_ROOT', `Expected root <svg>, received <${document.name}>`, '/'),
    );
  }

  const version = document.attributes[`${DSVG_ATTR_PREFIX}version`];
  if (!version) {
    errors.push(
      createError(
        'UNSUPPORTED_VERSION',
        `Missing ${DSVG_ATTR_PREFIX}version. DSVG 0.1 requires ${DSVG_ATTR_PREFIX}version="${DSVG_SPEC_VERSION}"`,
        '/',
      ),
    );
  } else if (version !== DSVG_SPEC_VERSION) {
    errors.push(
      createError(
        'UNSUPPORTED_VERSION',
        `Unsupported DSVG version "${version}". Supported: ${DSVG_SPEC_VERSION}`,
        '/',
      ),
    );
  }

  validateNode(document, 'svg', errors, false);

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, document };
};
