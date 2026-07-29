declare module '@shuding/opentype.js' {
  export type Font = {
    unitsPerEm: number;
    ascender: number;
    descender: number;
    getAdvanceWidth: (
      text: string,
      fontSize: number,
      options?: { letterSpacing?: number },
    ) => number;
    toArrayBuffer?: () => ArrayBuffer;
  };

  export class Path {
    moveTo: (x: number, y: number) => void;
    lineTo: (x: number, y: number) => void;
    close: () => void;
  }

  export class Glyph {
    constructor(options: { name: string; unicode?: number; advanceWidth: number; path: Path });
  }

  export class FontCtor {
    constructor(options: {
      familyName: string;
      styleName: string;
      unitsPerEm: number;
      ascender: number;
      descender: number;
      glyphs: Glyph[];
    });
    toArrayBuffer: () => ArrayBuffer;
  }

  export const parse: (buffer: ArrayBuffer | ArrayBufferLike) => Font;
  export const Font: {
    new (options: {
      familyName: string;
      styleName: string;
      unitsPerEm: number;
      ascender: number;
      descender: number;
      glyphs: Glyph[];
    }): Font & { toArrayBuffer: () => ArrayBuffer };
  };

  const opentype: {
    parse: typeof parse;
    Font: typeof Font;
    Glyph: typeof Glyph;
    Path: typeof Path;
  };

  export default opentype;
}
