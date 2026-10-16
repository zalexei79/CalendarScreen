import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { newExtension, validateExtensions, extensionLink, extensionPrompt } from '../src/features/extensions/extensionModel.js';
import { sandboxDocument } from '../src/features/extensions/extensionSandbox.js';
const one = () => ({ schema:1, features:[newExtension()] });
test('project extension manifest is valid, including future user-created functions', () => {
  const source = JSON.parse(fs.readFileSync('src/features/extensions/extensions.json','utf8'));
  assert.equal(validateExtensions(source).features.length,source.features.length);
});
test('normalizes only supported fields and clamps device geometry', () => {
  const config = one(); config.features[0].mobile.x = 900; config.features[0].desktop.width = -1; config.features[0].token = 'never-passed';
  const result = validateExtensions(config).features[0];
  assert.equal(result.mobile.x,100); assert.equal(result.desktop.width,64); assert.equal(result.token,undefined);
  assert.equal(result.steps[0].type,'screen'); assert.match(extensionPrompt(result), /Без React/);
});
test('rejects duplicates, oversized code, invalid and ambiguous action sequences', () => {
  const config = one(); config.features.push(config.features[0]); assert.throws(() => validateExtensions(config),/ID/);
  const invalid = one(); invalid.features[0].js = 'x'.repeat(65537); assert.throws(() => validateExtensions(invalid),/JavaScript/);
  invalid.features[0].js = ''; invalid.features[0].steps = [{type:'execute-shell'}]; assert.throws(() => validateExtensions(invalid),/тип/);
  invalid.features[0].steps = [{type:'screen'},{type:'message',value:'after'}]; assert.throws(() => validateExtensions(invalid),/последним/);
  invalid.features[0].steps = [{type:'navigate',value:'javascript:alert(1)'}]; assert.throws(() => validateExtensions(invalid),/HTTPS/);
  invalid.features[0].steps = [{type:'builtin',action:'delete-user'}]; assert.throws(() => validateExtensions(invalid),/не подключено/);
  invalid.features[0].steps = [{type:'builtin',action:'settings'}]; assert.equal(validateExtensions(invalid).features[0].steps[0].action,'settings');
});
test('links cannot use script, credentials, protocol-relative hosts or backslash tricks', () => {
  for (const link of ['javascript:alert(1)','data:text/html,test','//evil.test','/\\evil.test','https://user:pass@evil.test','https://evil.test/a b']) assert.equal(extensionLink(link),'');
  assert.equal(extensionLink('/?screen=test'),'/?screen=test'); assert.equal(extensionLink('https://example.com/'),'https://example.com/');
});
test('sandbox policy precedes markup, disables network, and does not add host authority', () => {
  const feature = newExtension(); feature.js = 'const value = "</script><script>alert(1)</script>";';
  const html = sandboxDocument(feature,'test-channel');
  assert.ok(html.indexOf('Content-Security-Policy') < html.indexOf('srcdoc='));
  assert.ok(!html.includes(feature.html), 'untrusted markup is attribute-escaped in the trusted wrapper');
  assert.ok(html.includes('frame-src about:'));
  for (const policy of ["connect-src 'none'", "form-action 'none'", "base-uri 'none'", "frame-src 'none'"]) assert.ok(html.includes(policy));
  assert.ok(!html.includes('"</script><script>alert'));
  const screen = fs.readFileSync('src/features/extensions/ExtensionScreen.jsx','utf8');
  assert.ok(html.includes('sandbox="allow-scripts"')); assert.ok(!html.includes('allow-same-origin'));
  assert.match(screen,/event\.source !== frame\.current\?\.contentWindow/); assert.match(screen,/event\.origin !== location\.origin/);
  assert.ok(!html.includes('supabase')); assert.ok(!html.includes('DESK_TOKEN'));
});
