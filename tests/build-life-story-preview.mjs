import { build } from 'esbuild';
import fs from 'node:fs';
const bundle = await build({ entryPoints: ['tests/life-story-preview.jsx'], bundle: true, write: false, outfile: 'preview.js', format: 'iife', plugins: [{ name: 'use-built-styles', setup(plugin) { plugin.onLoad({ filter: /src[\\/]styles\.css$/ }, () => ({ contents: '', loader: 'css' })); } }] });
const cssFile = fs.readdirSync('dist/assets').find(name => name.endsWith('.css'));
const css = fs.readFileSync(`dist/assets/${cssFile}`, 'utf8') + (bundle.outputFiles.find(file => file.path.endsWith('.css'))?.text || '');
const js = bundle.outputFiles.find(file => file.path.endsWith('.js')).text;
fs.writeFileSync('tests/.life-story-preview.html', `<!doctype html><html lang="ru"><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DAYRIS · First launch preview</title><style>${css}</style><body style="margin:0"><div id="root"></div><script>${js.replaceAll('</script>', '<\\/script>')}</script></body></html>`);
console.log('Standalone first-launch preview built.');
