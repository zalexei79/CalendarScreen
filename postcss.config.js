import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import displayScale from './scripts/postcss-display-scale.mjs';

export default { plugins:[tailwindcss(), autoprefixer(), displayScale()] };
