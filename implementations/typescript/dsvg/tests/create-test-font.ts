import opentype from '@shuding/opentype.js';

/**
 * Builds a tiny deterministic OpenType font for tests and playground demos.
 * @param familyName - Font family name.
 * @param weight - Numeric font weight stored on the face.
 * @returns Font binary suitable for `options.fonts`.
 */
export const createTestFontData = (familyName = 'TestFont', weight = 400): ArrayBuffer => {
  const notdefPath = new opentype.Path();
  notdefPath.moveTo(100, 0);
  notdefPath.lineTo(500, 0);
  notdefPath.lineTo(500, 700);
  notdefPath.lineTo(100, 700);
  notdefPath.close();

  const glyphs = [
    new opentype.Glyph({
      name: '.notdef',
      unicode: 0,
      advanceWidth: 650,
      path: notdefPath,
    }),
  ];

  const advanceFor = (char: string): number => {
    if (char === ' ') {
      return 300;
    }
    if (char === 'i' || char === 'l' || char === 'I') {
      return 280;
    }
    if (char === 'W' || char === 'M' || char === 'm') {
      return 780;
    }
    return 560;
  };

  const chars = ' ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,!?-_:;\'"';
  for (const char of chars) {
    const advanceWidth = advanceFor(char);
    const path = new opentype.Path();
    path.moveTo(40, 0);
    path.lineTo(advanceWidth - 40, 0);
    path.lineTo(advanceWidth - 40, 700);
    path.lineTo(40, 700);
    path.close();
    glyphs.push(
      new opentype.Glyph({
        name: char === ' ' ? 'space' : char,
        unicode: char.charCodeAt(0),
        advanceWidth,
        path,
      }),
    );
  }

  void weight;

  const font = new opentype.Font({
    familyName,
    styleName: weight >= 700 ? 'Bold' : 'Regular',
    unitsPerEm: 1000,
    ascender: 800,
    descender: -200,
    glyphs,
  });

  return font.toArrayBuffer();
};
