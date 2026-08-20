import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docs: [
    'intro',
    {
      type: 'category',
      label: 'Guide',
      items: [
        'guide/file-extensions',
        'guide/layout',
        'guide/templating',
        'guide/compile-pipeline',
        'guide/print-metadata',
      ],
    },
    {
      type: 'category',
      label: 'Specification',
      items: ['spec/overview'],
    },
    {
      type: 'category',
      label: 'Implementations',
      collapsed: false,
      items: ['implementations/typescript'],
    },
    {
      type: 'category',
      label: 'Contributing',
      items: ['contributing/releases'],
    },
  ],
};

export default sidebars;
