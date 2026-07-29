import BrowserOnly from '@docusaurus/BrowserOnly';
import useBaseUrl from '@docusaurus/useBaseUrl';
import Layout from '@theme/Layout';
import { useDeferredValue, useEffect, useState } from 'react';

import { PlaygroundCodeEditor } from '../components/PlaygroundCodeEditor';
import styles from './playground.module.css';

const initialSource = `<svg xmlns="http://www.w3.org/2000/svg" data-dsvg-version="0.1" width="560" height="180" viewBox="0 0 560 180">
  <rect width="560" height="180" rx="20" fill="#eef3ff" />
  <g
    data-dsvg-layout="flex"
    data-dsvg-width="560"
    data-dsvg-height="180"
    data-dsvg-padding="28"
    data-dsvg-gap="20"
    data-dsvg-justify-content="center"
    data-dsvg-align-items="center"
  >
    <circle r="42" fill="{{accent}}" />
    <text font-size="30" font-family="Inter" font-weight="700" fill="#172033">{{title}}</text>
  </g>
</svg>`;

const initialVariables = `{
  "accent": "#2a5bd7",
  "title": "Hello DSVG"
}`;

type Compilation = {
  error?: string;
  svg: string;
};

type PlaygroundFont = {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 700;
  style: 'normal';
};

/**
 * Parses playground variables as a string-keyed object.
 * @param source - JSON source entered by the user.
 * @returns Parsed template variables.
 */
const parseVariables = (source: string): Record<string, unknown> => {
  const parsed: unknown = JSON.parse(source);
  if (parsed === null || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error('Variables must be a JSON object.');
  }
  return parsed as Record<string, unknown>;
};

/**
 * Converts an unknown thrown value into readable text.
 * @param error - Value thrown during compilation.
 * @returns Human-readable error message.
 */
const formatError = (error: unknown): string =>
  error instanceof Error ? error.message : 'Unknown compilation error.';

/**
 * Loads a font file into an ArrayBuffer.
 * @param url - Font asset URL.
 * @returns Font bytes.
 */
const loadFontData = async (url: string): Promise<ArrayBuffer> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load playground font (${response.status}).`);
  }
  return response.arrayBuffer();
};

/**
 * Encodes font bytes as a base64 data URL for preview embedding.
 * @param data - Font bytes.
 * @returns Data URL string.
 */
const toFontDataUrl = (data: ArrayBuffer): string => {
  const bytes = new Uint8Array(data);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return `data:font/ttf;base64,${btoa(binary)}`;
};

/**
 * Renders interactive DSVG compiler playground.
 * @returns Playground page.
 */
const PlaygroundPage = () => {
  const regularFontUrl = useBaseUrl('/fonts/dsvg-demo.ttf');
  const boldFontUrl = useBaseUrl('/fonts/dsvg-demo-bold.ttf');
  const [source, setSource] = useState(initialSource);
  const [variables, setVariables] = useState(initialVariables);
  const [fonts, setFonts] = useState<PlaygroundFont[] | null>(null);
  const [fontError, setFontError] = useState<string | undefined>();
  const [compilation, setCompilation] = useState<Compilation>({ svg: '' });
  const deferredSource = useDeferredValue(source);
  const deferredVariables = useDeferredValue(variables);

  useEffect(() => {
    let cancelled = false;

    /**
     * Loads bundled demo fonts for deterministic text measurement.
     * @returns Promise resolved after fonts are ready or fail.
     */
    const loadFonts = async (): Promise<void> => {
      try {
        const [regular, bold] = await Promise.all([
          loadFontData(regularFontUrl),
          loadFontData(boldFontUrl),
        ]);
        if (!cancelled) {
          setFonts([
            { name: 'Inter', data: regular, weight: 400, style: 'normal' },
            { name: 'Inter', data: bold, weight: 700, style: 'normal' },
          ]);
          setFontError(undefined);
        }
      } catch (error) {
        if (!cancelled) {
          setFontError(formatError(error));
        }
      }
    };

    void loadFonts();
    return () => {
      cancelled = true;
    };
  }, [boldFontUrl, regularFontUrl]);

  useEffect(() => {
    let cancelled = false;

    /**
     * Compiles current editor input in browser.
     * @returns Promise resolved after compilation state updates.
     */
    const compile = async (): Promise<void> => {
      if (!fonts) {
        return;
      }
      try {
        const parsedVariables = parseVariables(deferredVariables);
        const { compileDsvg } = await import('@deckify/dsvg');
        const result = await compileDsvg(deferredSource, {
          variables: parsedVariables,
          fonts,
        });
        if (!cancelled) {
          setCompilation({ svg: result.svg });
        }
      } catch (error) {
        if (!cancelled) {
          setCompilation({ error: formatError(error), svg: '' });
        }
      }
    };

    void compile();
    return () => {
      cancelled = true;
    };
  }, [deferredSource, deferredVariables, fonts]);

  const previewFontFace =
    fonts === null
      ? ''
      : `@font-face{font-family:'Inter';src:url('${toFontDataUrl(fonts[0]!.data)}') format('truetype');font-weight:400;font-style:normal;font-display:block;}@font-face{font-family:'Inter';src:url('${toFontDataUrl(fonts[1]!.data)}') format('truetype');font-weight:700;font-style:normal;font-display:block;}`;

  const previewDocument = compilation.svg
    ? `<!doctype html><html><head><style>${previewFontFace}html,body{min-height:100%;padding:0}body{display:grid;place-items:center;background:#fff}svg{max-width:100%;height:auto}</style></head><body>${compilation.svg}</body></html>`
    : '';

  const statusLabel = fontError
    ? 'Font error'
    : !fonts
      ? 'Loading fonts'
      : compilation.error
        ? 'Error'
        : 'Compiled';

  return (
    <Layout
      title="Playground"
      description="Compile DSVG templates and preview generated SVG in browser."
    >
      <main className={styles.page}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>DSVG compiler</p>
          <h1>Playground</h1>
          <p>
            Edit DSVG and template variables. Flex text is measured from the bundled{' '}
            <code>Inter</code> OpenType faces.
          </p>
        </header>

        <div className={styles.workspace}>
          <section className={styles.panel} aria-labelledby="source-heading">
            <div className={styles.panelHeader}>
              <h2 id="source-heading">DSVG source</h2>
              <span>.dsvg</span>
            </div>
            <BrowserOnly
              fallback={<div className={`${styles.codeEditorShell} ${styles.sourceEditor}`} />}
            >
              {() => (
                <PlaygroundCodeEditor
                  className={styles.sourceEditor}
                  language="xml"
                  aria-label="DSVG source"
                  value={source}
                  onChange={setSource}
                />
              )}
            </BrowserOnly>
            <div className={styles.panelHeader}>
              <h2 id="variables-heading">Variables</h2>
              <span>JSON</span>
            </div>
            <BrowserOnly
              fallback={<div className={`${styles.codeEditorShell} ${styles.variablesEditor}`} />}
            >
              {() => (
                <PlaygroundCodeEditor
                  className={styles.variablesEditor}
                  language="json"
                  aria-labelledby="variables-heading"
                  value={variables}
                  onChange={setVariables}
                />
              )}
            </BrowserOnly>
          </section>

          <section className={styles.panel} aria-labelledby="preview-heading">
            <div className={styles.panelHeader}>
              <h2 id="preview-heading">Preview</h2>
              <span aria-live="polite">{statusLabel}</span>
            </div>
            <div className={styles.preview}>
              {fontError || compilation.error ? (
                <pre className={styles.error} role="alert">
                  {fontError ?? compilation.error}
                </pre>
              ) : (
                <iframe
                  className={styles.previewFrame}
                  title="Compiled SVG preview"
                  sandbox="allow-same-origin"
                  srcDoc={previewDocument}
                />
              )}
            </div>
            <div className={styles.panelHeader}>
              <h2 id="output-heading">Compiled SVG</h2>
              <span>SVG</span>
            </div>
            <BrowserOnly
              fallback={<div className={`${styles.codeEditorShell} ${styles.outputEditor}`} />}
            >
              {() => (
                <PlaygroundCodeEditor
                  className={styles.outputEditor}
                  language="xml"
                  aria-labelledby="output-heading"
                  value={compilation.svg}
                  readOnly
                />
              )}
            </BrowserOnly>
          </section>
        </div>
      </main>
    </Layout>
  );
};

export default PlaygroundPage;
