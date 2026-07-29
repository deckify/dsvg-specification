import type { DsvgError, DsvgErrorCode } from './types.js';

/**
 * Builds a structured DSVG error object.
 * @param code - Machine-readable error code.
 * @param message - Human-readable description.
 * @param path - Optional AST path for the failing node or attribute.
 * @returns Structured error value.
 */
export const createError = (code: DsvgErrorCode, message: string, path?: string): DsvgError => ({
  code,
  message,
  ...(path !== undefined ? { path } : {}),
});

/**
 * Error thrown when DSVG parsing, validation, templating, or layout fails.
 */
export class DsvgCompileError extends Error {
  readonly errors: DsvgError[];

  /**
   * Creates a compile error from one or more structured DSVG errors.
   * @param errors - Collected DSVG errors to surface.
   */
  constructor(errors: DsvgError[]) {
    const summary = errors.map((error) => error.message).join('; ');
    super(summary || 'DSVG compilation failed');
    this.name = 'DsvgCompileError';
    this.errors = errors;
  }
}
