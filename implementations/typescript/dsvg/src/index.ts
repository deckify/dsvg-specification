export { DsvgCompileError } from './errors.js';
export { getDsvgSourceExtension, isDsvgFilename, toCompiledSvgFilename } from './filename.js';
export { parseDsvg, serializeDsvg } from './parse.js';
export { validateDsvg } from './validate.js';
export { renderTemplate } from './template.js';
export { applyYogaLayout } from './layout.js';
export { stripDsvgAttributes } from './strip.js';
export { compileDsvg, compileDsvgDocument } from './compile.js';
export {
  collectTextContent,
  createFontMeasurer,
  normalizeTextContent,
  normalizeTextElementContent,
  parseFontFamilies,
  parseFontSize,
} from './text-measurement.js';
export {
  DSVG_ATTR_PREFIX,
  DSVG_SPEC_VERSION,
  SUPPORTED_SOURCE_EXTENSIONS,
  type CompileOptions,
  type CompileResult,
  type DsvgDocument,
  type DsvgError,
  type DsvgErrorCode,
  type DsvgNode,
  type FontOptions,
  type FontStyle,
  type FontWeight,
  type LayoutOptions,
  type RenderTemplateOptions,
  type TemplateVariables,
  type TextMeasurementMode,
  type ValidationResult,
} from './types.js';
