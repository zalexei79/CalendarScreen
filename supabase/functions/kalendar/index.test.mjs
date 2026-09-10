import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { id, parseMessage } from './core.mjs';

// Load the deployed implementation without starting Deno or contacting services.
const source = (await readFile(new URL('./index.ts', import.meta.url), 'utf8'))
  .replace(/^import .*;\r?\n/gm, '');
const context = vm.createContext({ id, serve() {} });
vm.runInContext(source, context);
const encode = context.encodeRequest;

test('account auth sends a JSON integer; credentials stay escaped strings', () => {
  const accessToken = 'quoted"\\token\n123';
  const wire = encode('request-1', 2102, { ctidTraderAccountId: '12345678', accessToken });
  assert.deepEqual(JSON.parse(wire), { clientMsgId: 'request-1', payloadType: 2102,
    payload: { ctidTraderAccountId: 12345678, accessToken } });
});

test('every account request preserves int64 digits without quotation or rounding', () => {
  for (const payloadType of [2102, 2121, 2112, 2114, 2133]) {
    const wire = encode('test', payloadType, { ctidTraderAccountId: '9223372036854775807' });
    assert.ok(wire.includes('"ctidTraderAccountId":9223372036854775807'));
    assert.equal(parseMessage(wire).payload.ctidTraderAccountId, '9223372036854775807');
  }
});

test('application auth, token strings and history parameters retain their JSON types', () => {
  for (const payload of [{ clientId: '00123', clientSecret: '456' }, { accessToken: '789' },
    { ctidTraderAccountId: '123', fromTimestamp: 0, toTimestamp: 123456789, maxRows: 1000, includeArchivedSymbols: true }]) {
    const expected = { ...payload };
    if (expected.ctidTraderAccountId) expected.ctidTraderAccountId = 123;
    assert.deepEqual(JSON.parse(encode('test', 2133, payload)).payload, expected);
  }
});

test('malformed and already rounded IDs are rejected before serialization', () => {
  for (const value of ['1,"injected":true', '1.5', '-1', undefined, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => encode('test', 2102, { ctidTraderAccountId: value }));
  }
});
