import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parse} from '@babel/parser';

test('inline calendar locale bundles cover every supported language and key', () => {
  const ast = parse(fs.readFileSync('CalendarScreen.jsx', 'utf8'), {sourceType:'module', plugins:['jsx']});
  let checked = 0;
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'ObjectExpression') {
      const entries = new Map(node.properties.filter(p => p.type === 'ObjectProperty').map(p => [p.key.name || p.key.value, p.value]));
      if (['ru','en','ro'].every(key => entries.get(key)?.type === 'ObjectExpression')) {
        checked += 1;
        const chinese = entries.has('zh') ? 'zh' : 'zh-CN';
        assert.ok(entries.has(chinese), `Missing Chinese bundle at line ${node.loc.start.line}`);
        const keys = locale => entries.get(locale).properties.map(p => p.key.name || p.key.value).sort();
        for (const locale of ['en','ro',chinese]) assert.deepEqual(keys(locale), keys('ru'), `${locale} keys at line ${node.loc.start.line}`);
      }
    }
    for (const value of Object.values(node)) if (Array.isArray(value)) value.forEach(visit); else if (value && typeof value === 'object') visit(value);
  }
  visit(ast);
  assert.ok(checked >= 5);
});
