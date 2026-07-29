import type { SUPPORTED_SOURCE_EXTENSIONS } from './types.js';

const SOURCE_EXTENSION_PATTERN = /\.(?:d\.svg|dsvg)$/i;

/**
 * Returns true when `filename` ends with `.dsvg` or `.d.svg`.
 * Ordinary `.svg` files are not treated as DSVG sources.
 * @param filename - Filename or path to inspect.
 * @returns Whether the filename is a DSVG source.
 */
export const isDsvgFilename = (filename: string): boolean =>
  SOURCE_EXTENSION_PATTERN.test(filename);

/**
 * Returns the matched DSVG source extension, or undefined.
 * @param filename - Filename or path to inspect.
 * @returns Matched `.dsvg` / `.d.svg` extension, if any.
 */
export const getDsvgSourceExtension = (
  filename: string,
): (typeof SUPPORTED_SOURCE_EXTENSIONS)[number] | undefined => {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.d.svg')) {
    return '.d.svg';
  }
  if (lower.endsWith('.dsvg')) {
    return '.dsvg';
  }
  return undefined;
};

/**
 * Suggests a compiled `.svg` output path for a DSVG source filename.
 * @param filename - Source filename or path.
 * @returns Filename with a `.svg` extension suitable for compiled output.
 */
export const toCompiledSvgFilename = (filename: string): string => {
  const ext = getDsvgSourceExtension(filename);
  if (!ext) {
    return filename.endsWith('.svg') ? filename : `${filename}.svg`;
  }
  return `${filename.slice(0, -ext.length)}.svg`;
};
