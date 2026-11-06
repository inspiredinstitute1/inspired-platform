import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';

export default defineConfig([
  ...nextVitals,
  globalIgnores(['dist/**', '.next/**', '.wrangler/**', '.sites-runtime/**', 'public/portal.bundle.js', 'public/assets/**', 'lib/portal-shell.ts', 'next-env.d.ts']),
  {
    files: ['app/layout.tsx'],
    // The retained portal shell uses public stylesheets copied by prepare-portal.
    rules: { '@next/next/no-css-tags': 'off' },
  },
]);
