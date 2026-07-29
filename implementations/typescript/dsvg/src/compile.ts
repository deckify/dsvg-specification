import { cloneDocument } from './clone.js';
import { DsvgCompileError } from './errors.js';
import { applyYogaLayout } from './layout.js';
import { parseDsvg, serializeDsvg } from './parse.js';
import { stripDsvgAttributes } from './strip.js';
import { renderTemplate } from './template.js';
import type { CompileOptions, CompileResult, DsvgDocument } from './types.js';
import { validateDsvg } from './validate.js';

/**
 * Compiles an existing DSVG AST through validation, templating, and layout.
 * @param document - Source document AST.
 * @param options - Compile options including template variables.
 * @returns Compiled SVG string and resulting document AST.
 */
export const compileDsvgDocument = async (
  document: DsvgDocument,
  options: CompileOptions = {},
): Promise<CompileResult> => {
  const structural = validateDsvg(document);
  if (!structural.ok) {
    throw new DsvgCompileError(structural.errors);
  }

  let current = cloneDocument(document);
  current = await renderTemplate(current, options.variables ?? {}, {
    strictMissing: options.strictMissing,
  });

  const afterTemplate = validateDsvg(current);
  if (!afterTemplate.ok) {
    throw new DsvgCompileError(afterTemplate.errors);
  }

  current = applyYogaLayout(current, {
    fonts: options.fonts,
    textMeasurement: options.textMeasurement,
  });

  if (options.stripDsvgAttributes !== false) {
    current = stripDsvgAttributes(current);
  }

  return {
    document: current,
    svg: serializeDsvg(current),
  };
};

/**
 * Parses and compiles a DSVG source string into static SVG.
 * @param source - Raw DSVG XML source.
 * @param options - Compile options including template variables.
 * @returns Compiled SVG string and resulting document AST.
 */
export const compileDsvg = async (
  source: string,
  options: CompileOptions = {},
): Promise<CompileResult> => {
  const document = await parseDsvg(source);
  return compileDsvgDocument(document, options);
};
