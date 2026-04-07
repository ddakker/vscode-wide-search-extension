import * as esbuild from 'esbuild';

const isWatch = process.argv.includes('--watch');
const isRelease = process.argv.includes('--release');

const drop = isRelease ? ['console'] : [];

const extensionConfig = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  sourcemap: true,
  minify: !isWatch,
  drop,
};

const webviewConfig = {
  entryPoints: ['src/webview/app.ts'],
  bundle: true,
  outfile: 'dist/webview/app.js',
  format: 'iife',
  platform: 'browser',
  sourcemap: true,
  minify: !isWatch,
  drop,
};

if (isWatch) {
  const extCtx = await esbuild.context(extensionConfig);
  const webCtx = await esbuild.context(webviewConfig);
  await Promise.all([extCtx.watch(), webCtx.watch()]);
  console.log('Watching...');
} else {
  await Promise.all([
    esbuild.build(extensionConfig),
    esbuild.build(webviewConfig),
  ]);
  console.log('Build complete');
}
