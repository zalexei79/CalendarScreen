import fs from 'node:fs/promises';
import { validateExtensions } from '../src/features/extensions/extensionModel.js';
const config = validateExtensions(JSON.parse(await fs.readFile(new URL('../src/features/extensions/extensions.json', import.meta.url), 'utf8')));
console.log(`DAYRIS functions: ${config.features.length} validated`);
