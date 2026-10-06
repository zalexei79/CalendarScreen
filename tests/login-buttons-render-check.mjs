import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { Module } from 'node:module';

// Use the same classic JSX transform as the Vite build. Rendering catches
// missing React imports, which successful compilation alone cannot detect.
const result = await build({
  stdin: { contents: `
    import React from 'react';
    import { renderToStaticMarkup } from 'react-dom/server';
    import LoginButtons from './src/features/auth/LoginButtons.jsx';
    export const render = props => renderToStaticMarkup(React.createElement(LoginButtons, {
      t: key => key, handleGoogleLogin() {}, handleTelegramLogin() {}, ...props
    }));
  `, resolveDir: process.cwd(), loader: 'jsx' },
  bundle: true, platform: 'node', format: 'cjs', write: false, logLevel: 'silent',
});
const renderedModule = new Module('login-buttons-render-check');
renderedModule._compile(result.outputFiles[0].text, 'login-buttons-render-check.cjs');
const render = renderedModule.exports.render;
const ready = render({});
assert.equal((ready.match(/<button/g) || []).length, 2);
assert.ok(ready.includes('signInTelegram'));
assert.ok(!ready.includes('disabled='));
const pending = render({ loginPending: 'custom:telegram', loginError: 'Try again' });
assert.equal((pending.match(/disabled=""/g) || []).length, 2);
assert.ok(pending.includes('authConnecting'));
assert.ok(pending.includes('role="alert"'));
console.log('Guest login buttons render with classic JSX; pending and error states passed.');
