import fs from 'node:fs/promises';
import postcss from 'postcss';
import { validLocalCSS } from '../src/features/appearance/designModel.js';
const root=new URL('../src/features/appearance/',import.meta.url);
const config=JSON.parse(await fs.readFile(new URL('siteDesign.json',root),'utf8'));
if(config.schema!==1 || !config.mobile || !config.desktop || typeof config.overrideCloud !== 'boolean')throw new Error('Неверный siteDesign.json.');
const css=validLocalCSS(await fs.readFile(new URL('calendar-custom.css',root),'utf8'));
postcss.parse(css,{from:'calendar-custom.css'});
console.log('DAYRIS design: source config and CSS syntax validated');
