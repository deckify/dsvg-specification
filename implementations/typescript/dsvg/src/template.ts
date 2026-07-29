import { cloneDocument } from './clone.js';
import { DsvgCompileError, createError } from './errors.js';
import { escapeXmlAttr, escapeXmlText, parseXmlFragment } from './parse.js';
import type {
  DsvgDocument,
  DsvgError,
  DsvgNode,
  RenderTemplateOptions,
  TemplateVariables,
} from './types.js';

const UNSUPPORTED_MUSTACHE = /\{\{\s*[#^/>]/;
const TOKEN_PATTERN = /\{\{\{\s*([^}]+?)\s*\}\}\}|\{\{\s*(&\s*)?([^}]+?)\s*\}\}/g;

/**
 * Looks up a dotted variable path in a variables object.
 * @param variables - Template variable map.
 * @param path - Dotted path such as `label.title`.
 * @returns Resolved value, or undefined when missing.
 */
const lookupVariable = (variables: TemplateVariables, path: string): unknown => {
  const parts = path
    .split('.')
    .map((part) => part.trim())
    .filter(Boolean);
  let current: unknown = variables;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
};

/**
 * Converts a resolved variable to a string, reporting type errors.
 * @param value - Resolved variable value.
 * @param path - Variable path for error reporting.
 * @param errors - Error accumulator.
 * @returns Stringified value, or undefined when missing/invalid.
 */
const stringifyVariable = (
  value: unknown,
  path: string,
  errors: DsvgError[],
): string | undefined => {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  errors.push(
    createError('INVALID_VARIABLE_TYPE', `Variable "${path}" resolved to a non-primitive value`),
  );
  return undefined;
};

type RenderedSurface = {
  value: string;
  /** True when any raw Mustache token contributed to this surface. */
  hadRaw: boolean;
};

/**
 * Renders Mustache tokens inside a single string surface.
 * @param input - Source string that may contain Mustache tokens.
 * @param variables - Template variable map.
 * @param options - Rendering options.
 * @param errors - Error accumulator.
 * @param surfacePath - AST path for diagnostics.
 * @param escape - Escaper used for `{{name}}` tokens on this surface.
 * @returns Rendered string plus whether raw tokens were used.
 */
const renderString = (
  input: string,
  variables: TemplateVariables,
  options: Required<Pick<RenderTemplateOptions, 'strictMissing'>>,
  errors: DsvgError[],
  surfacePath: string,
  escape: (value: string) => string,
): RenderedSurface => {
  if (UNSUPPORTED_MUSTACHE.test(input)) {
    errors.push(
      createError(
        'UNSUPPORTED_MUSTACHE',
        'DSVG 0.1 supports variable interpolation only (no sections, partials, or lambdas)',
        surfacePath,
      ),
    );
    return { value: input, hadRaw: false };
  }

  let hadRaw = false;
  const value = input.replace(
    TOKEN_PATTERN,
    (match, tripleName?: string, ampPrefix?: string, braceName?: string) => {
      const raw = Boolean(tripleName || ampPrefix);
      const name = (tripleName ?? braceName ?? '').trim();
      if (!name) {
        errors.push(
          createError('INVALID_VALUE', `Empty Mustache token in "${match}"`, surfacePath),
        );
        return match;
      }

      const resolved = lookupVariable(variables, name);
      const asString = stringifyVariable(resolved, name, errors);
      if (asString === undefined) {
        if (options.strictMissing) {
          errors.push(
            createError('MISSING_VARIABLE', `Missing template variable "${name}"`, surfacePath),
          );
          return match;
        }
        return '';
      }
      if (raw) {
        hadRaw = true;
        return asString;
      }
      return escape(asString);
    },
  );
  return { value, hadRaw };
};

/**
 * Replaces a text node with parsed XML fragment children when raw markup was injected.
 * @param parent - Parent element owning the text node.
 * @param index - Child index of the text node.
 * @param fragment - Raw XML fragment or plain text.
 * @param path - AST path for diagnostics.
 * @param errors - Error accumulator.
 * @returns Nothing.
 */
const applyRawTextSurface = async (
  parent: DsvgNode,
  index: number,
  fragment: string,
  path: string,
  errors: DsvgError[],
): Promise<void> => {
  if (!fragment.includes('<')) {
    const child = parent.children[index];
    if (child) {
      child.value = fragment;
    }
    return;
  }

  try {
    const nodes = await parseXmlFragment(fragment);
    parent.children.splice(index, 1, ...nodes);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push(
      createError('INVALID_VALUE', `Raw Mustache value is not valid XML: ${message}`, path),
    );
  }
};

/**
 * Recursively renders Mustache tokens on a node and its descendants.
 * @param node - Node to render in place.
 * @param variables - Template variable map.
 * @param options - Rendering options.
 * @param errors - Error accumulator.
 * @param path - AST path for diagnostics.
 * @returns Nothing.
 */
const renderNode = async (
  node: DsvgNode,
  variables: TemplateVariables,
  options: Required<Pick<RenderTemplateOptions, 'strictMissing'>>,
  errors: DsvgError[],
  path: string,
): Promise<void> => {
  if (node.type === 'text' || node.name === '') {
    return;
  }

  for (const [attr, value] of Object.entries(node.attributes)) {
    const rendered = renderString(
      value,
      variables,
      options,
      errors,
      `${path}@${attr}`,
      escapeXmlAttr,
    );
    node.attributes[attr] = rendered.value;
  }

  for (let index = 0; index < node.children.length; index += 1) {
    const child = node.children[index];
    if (!child) {
      continue;
    }

    if (child.type === 'text' || child.name === '') {
      if (!child.value) {
        continue;
      }
      const childPath = `${path}/text()[${index}]`;
      const rendered = renderString(
        child.value,
        variables,
        options,
        errors,
        childPath,
        escapeXmlText,
      );
      if (rendered.hadRaw) {
        await applyRawTextSurface(node, index, rendered.value, childPath, errors);
      } else {
        child.value = rendered.value;
      }
      continue;
    }

    const childPath = `${path}/${child.name}[${index}]`;
    await renderNode(child, variables, options, errors, childPath);
  }
};

/**
 * Resolves Mustache variables in a DSVG document without mutating the input.
 * @param document - Source document.
 * @param variables - Template variable map.
 * @param options - Rendering options.
 * @returns Cloned document with variables resolved.
 */
export const renderTemplate = async (
  document: DsvgDocument,
  variables: TemplateVariables = {},
  options: RenderTemplateOptions = {},
): Promise<DsvgDocument> => {
  const cloned = cloneDocument(document);
  const errors: DsvgError[] = [];
  await renderNode(
    cloned,
    variables,
    { strictMissing: options.strictMissing ?? true },
    errors,
    'svg',
  );

  if (errors.length > 0) {
    throw new DsvgCompileError(errors);
  }
  return cloned;
};
