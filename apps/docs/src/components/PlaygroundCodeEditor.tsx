import { json } from '@codemirror/lang-json';
import { xml } from '@codemirror/lang-xml';
import { githubDark, githubLight } from '@uiw/codemirror-theme-github';
import CodeMirror from '@uiw/react-codemirror';
import { useEffect, useState } from 'react';

import styles from '../pages/playground.module.css';

export type PlaygroundCodeLanguage = 'xml' | 'json';

type PlaygroundCodeEditorProps = {
  value: string;
  language: PlaygroundCodeLanguage;
  /** Accessible name for the editor. */
  'aria-label'?: string;
  /** Optional labelled-by id when a visible heading exists. */
  'aria-labelledby'?: string;
  className?: string;
  readOnly?: boolean;
  onChange?: (value: string) => void;
};

/**
 * Resolves CodeMirror language extensions for playground editors.
 * @param language - Editor language id.
 * @returns CodeMirror language extension list.
 */
const languageExtensions = (language: PlaygroundCodeLanguage) => {
  switch (language) {
    case 'json':
      return [json()];
    case 'xml':
      return [xml()];
  }
};

/**
 * Tracks Docusaurus color mode from the document root attribute.
 * @returns True when dark mode is active.
 */
const useIsDarkMode = (): boolean => {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    /**
     * Syncs local dark-mode state from `data-theme`.
     * @returns Nothing.
     */
    const sync = (): void => {
      setIsDark(root.getAttribute('data-theme') === 'dark');
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    return () => {
      observer.disconnect();
    };
  }, []);

  return isDark;
};

/**
 * Syntax-highlighted CodeMirror editor for the DSVG playground.
 * @param props - Editor props.
 * @returns Code editor element.
 */
export const PlaygroundCodeEditor = ({
  value,
  language,
  className,
  readOnly = false,
  onChange,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
}: PlaygroundCodeEditorProps) => {
  const isDark = useIsDarkMode();
  const theme = isDark ? githubDark : githubLight;

  return (
    <div className={`${styles.codeEditorShell} ${className ?? ''}`.trim()}>
      <CodeMirror
        value={value}
        height="100%"
        theme={theme}
        editable={!readOnly}
        readOnly={readOnly}
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          highlightActiveLine: !readOnly,
          highlightSelectionMatches: true,
          bracketMatching: true,
          autocompletion: !readOnly,
          indentOnInput: !readOnly,
        }}
        extensions={languageExtensions(language)}
        onChange={onChange}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
      />
    </div>
  );
};
