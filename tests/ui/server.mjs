import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const vitestRequire = createRequire(require.resolve('vitest/package.json'));
const { createServer } = await import(pathToFileURL(vitestRequire.resolve('vite')).href);
const root = dirname(fileURLToPath(import.meta.url));
const web = resolve(root, '../../apps/web');
const webRequire = createRequire(resolve(web, 'package.json'));
process.chdir(web);
const server = await createServer({
  root,
  configFile: false,
  resolve: { alias: [
    { find: 'next/navigation', replacement: resolve(root, 'navigation.ts') },
    { find: 'next/link', replacement: resolve(root, 'link.tsx') },
    { find: /^react-dom\/(.*)$/, replacement: `${dirname(webRequire.resolve('react-dom/package.json'))}/$1` },
    { find: /^react\/(.*)$/, replacement: `${dirname(webRequire.resolve('react/package.json'))}/$1` },
    { find: 'react', replacement: webRequire.resolve('react') },
    { find: 'react-dom', replacement: webRequire.resolve('react-dom') },
  ] },
  esbuild: { jsx: 'automatic' },
  css: { postcss: { plugins: [
    webRequire('tailwindcss')({
      ...webRequire('tailwindcss/loadConfig')(resolve(web, 'tailwind.config.ts')),
      content: [resolve(web, 'app/**/*.{ts,tsx}'), resolve(web, 'components/**/*.{ts,tsx}'), resolve(root, '*.tsx')],
    }),
    webRequire('autoprefixer')(),
  ] } },
  server: { port: 3105, host: '127.0.0.1', strictPort: true, fs: { allow: [resolve(root, '../..')] } },
});
await server.listen();
export { server };
