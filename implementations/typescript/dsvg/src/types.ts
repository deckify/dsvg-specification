export type DsvgNode = {
  name: string;
  type: 'element' | 'text' | string;
  value?: string;
  attributes: Record<string, string>;
  children: DsvgNode[];
};

export type DsvgDocument = DsvgNode & {
  name: 'svg';
};

export type DsvgErrorCode =
  | 'PARSE_ERROR'
  | 'INVALID_ROOT'
  | 'UNSUPPORTED_VERSION'
  | 'INVALID_ATTRIBUTE'
  | 'INVALID_VALUE'
  | 'UNSUPPORTED_MUSTACHE'
  | 'MISSING_VARIABLE'
  | 'INVALID_VARIABLE_TYPE'
  | 'LAYOUT_ERROR'
  | 'TEXT_MEASUREMENT_REQUIRED'
  | 'TEXT_MEASUREMENT_FAILED';

export type DsvgError = {
  code: DsvgErrorCode;
  message: string;
  path?: string;
};

export type TemplateVariables = Record<string, unknown>;

export type RenderTemplateOptions = {
  /** When false, missing variables become empty strings. Default: true */
  strictMissing?: boolean;
};

export type FontWeight = 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 'normal' | 'bold';

export type FontStyle = 'normal' | 'italic';

export type FontOptions = {
  /** Font family name matched against SVG `font-family`. */
  name: string;
  /** TTF, OTF, or WOFF font bytes. */
  data: ArrayBuffer | Uint8Array;
  /** Font weight. Default: `400`. */
  weight?: FontWeight;
  /** Font style. Default: `normal`. */
  style?: FontStyle;
};

export type TextMeasurementMode = 'font' | 'skip';

export type LayoutOptions = {
  /** OpenType fonts used for intrinsic `<text>` measurement. */
  fonts?: FontOptions[];
  /**
   * How flex `<text>` children are measured.
   * - `font` (default): measure with supplied OpenType fonts
   * - `skip`: keep legacy `0 × 0` sizing unless explicit `data-dsvg-*` dims exist
   */
  textMeasurement?: TextMeasurementMode;
};

export type CompileOptions = RenderTemplateOptions &
  LayoutOptions & {
    /** Strip `data-dsvg-*` attributes from output. Default: true */
    stripDsvgAttributes?: boolean;
    variables?: TemplateVariables;
  };

export type CompileResult = {
  svg: string;
  document: DsvgDocument;
};

export type ValidationResult =
  { ok: true; document: DsvgDocument } | { ok: false; errors: DsvgError[] };

export const DSVG_SPEC_VERSION = '0.1' as const;
export const DSVG_ATTR_PREFIX = 'data-dsvg-' as const;
export const SUPPORTED_SOURCE_EXTENSIONS = ['.dsvg', '.d.svg'] as const;
