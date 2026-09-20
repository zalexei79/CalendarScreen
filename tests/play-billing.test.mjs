import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlayBilling, PLAY_BILLING_METHOD } from '../src/features/pro/playBilling.mjs';

function fixture(overrides = {}) {
  const calls = [];
  const product = { itemId: 'pro_monthly', title: 'DAYRIS PRO', price: { currency: 'EUR', value: '1.99' } };
  const browser = {
    getDigitalGoodsService: async (method) => {
      assert.equal(method, PLAY_BILLING_METHOD);
      return {
        getDetails: async () => [product],
        listPurchases: async () => [
          { itemId: 'unrelated', purchaseToken: 'ignore' },
          { itemId: product.itemId, purchaseToken: 'restore-token' },
        ],
      };
    },
    PaymentRequest: class {
      constructor(methods, details) { calls.push({ methods, details }); }
      async show() {
        return { details: { purchaseToken: 'test-token' }, complete: async (status) => calls.push(status) };
      }
    },
    ...overrides,
  };
  return { browser, calls, product };
}

test('uses Play product price and completes only after backend verification', async () => {
  const { browser, calls, product } = fixture();
  const adapter = await createPlayBilling({ productId: product.itemId, browser, verifyPurchase: async (body) => {
    assert.deepEqual(body, { productId: 'pro_monthly', purchaseToken: 'test-token' });
    assert.equal(calls.length, 1);
    return { verified: true };
  } });
  await adapter.purchase();
  assert.equal(calls[0].methods[0].supportedMethods, PLAY_BILLING_METHOD);
  assert.deepEqual(calls[0].details.total.amount, product.price);
  assert.equal(calls[1], 'success');
});

test('rejects backend denial and completes payment UI as failed', async () => {
  const { browser, calls } = fixture();
  const adapter = await createPlayBilling({ productId: 'pro_monthly', browser, verifyPurchase: async () => ({ verified: false }) });
  await assert.rejects(adapter.purchase(), /NOT_VERIFIED/);
  assert.equal(calls.at(-1), 'fail');
});

test('restoration verifies matching purchases on server and ignores other products', async () => {
  const { browser } = fixture();
  const verified = [];
  const adapter = await createPlayBilling({ productId: 'pro_monthly', browser, verifyPurchase: async (body) => {
    verified.push(body); return { verified: true };
  } });
  assert.equal((await adapter.restore()).length, 1);
  assert.deepEqual(verified, [{ productId: 'pro_monthly', purchaseToken: 'restore-token' }]);
});

test('unavailable Play and unknown products cannot open an external checkout', async () => {
  await assert.rejects(createPlayBilling({ productId: 'pro_monthly', browser: {}, verifyPurchase: async () => {} }), /UNAVAILABLE/);
  const { browser } = fixture();
  await assert.rejects(createPlayBilling({ productId: 'missing', browser, verifyPurchase: async () => {} }), /PRODUCT_UNAVAILABLE/);
});

test('cancellation allows retry and never verifies a nonexistent purchase', async () => {
  let attempts = 0;
  const { browser } = fixture({ PaymentRequest: class {
    async show() { attempts++; throw new DOMException('Cancelled', 'AbortError'); }
  } });
  const adapter = await createPlayBilling({ productId: 'pro_monthly', browser, verifyPurchase: async () => assert.fail('must not verify') });
  await assert.rejects(adapter.purchase(), { name: 'AbortError' });
  await assert.rejects(adapter.purchase(), { name: 'AbortError' });
  assert.equal(attempts, 2);
});

test('concurrent clicks do not start a second payment', async () => {
  let resolveVerification;
  const { browser, calls } = fixture();
  const adapter = await createPlayBilling({ productId: 'pro_monthly', browser, verifyPurchase: () => new Promise((resolve) => { resolveVerification = resolve; }) });
  const first = adapter.purchase();
  await assert.rejects(adapter.purchase(), /BUSY/);
  resolveVerification({ verified: true });
  await first;
  assert.equal(calls.filter((entry) => entry.methods).length, 1);
});

test('missing token is rejected before backend verification', async () => {
  const { browser } = fixture({ PaymentRequest: class {
    async show() { return { details: {}, complete: async () => {} }; }
  } });
  const adapter = await createPlayBilling({ productId: 'pro_monthly', browser, verifyPurchase: async () => assert.fail('must not verify') });
  await assert.rejects(adapter.purchase(), /INVALID_PLAY_PURCHASE/);
});

test('browser completion errors do not undo a verified purchase', async () => {
  const { browser } = fixture({ PaymentRequest: class {
    async show() { return { details: { purchaseToken: 'test-token' }, complete: async () => { throw new Error('UI closed'); } }; }
  } });
  const adapter = await createPlayBilling({ productId: 'pro_monthly', browser, verifyPurchase: async () => ({ verified: true }) });
  assert.deepEqual(await adapter.purchase(), { verified: true });
});
