// TWA billing adapter. No entitlement is granted on the client.
// Connect only after the authenticated verification endpoint is deployed.
export const PLAY_BILLING_METHOD = 'https://play.google.com/billing';

export async function createPlayBilling({ productId, verifyPurchase, browser = globalThis.window }) {
  if (!productId || typeof verifyPurchase !== 'function') throw new Error('PLAY_BILLING_NOT_CONFIGURED');
  if (typeof browser?.getDigitalGoodsService !== 'function' || typeof browser?.PaymentRequest !== 'function') {
    throw new Error('PLAY_BILLING_UNAVAILABLE');
  }
  // Never fall back to a web checkout when Play is unavailable.
  const service = await browser.getDigitalGoodsService(PLAY_BILLING_METHOD);
  const details = await service.getDetails([productId]);
  const product = details.find((item) => item.itemId === productId);
  if (!product?.price?.currency || !Number.isFinite(Number(product.price.value)) || Number(product.price.value) < 0) {
    throw new Error('PLAY_PRODUCT_UNAVAILABLE');
  }
  let busy = false;

  async function verify(purchase) {
    if (purchase.itemId !== productId || typeof purchase.purchaseToken !== 'string' || !purchase.purchaseToken.trim()) {
      throw new Error('INVALID_PLAY_PURCHASE');
    }
    // Server must authenticate the user, verify with Google, bind the token to
    // that user, persist entitlement and acknowledge. Tokens are never logged.
    const result = await verifyPurchase({ productId, purchaseToken: purchase.purchaseToken });
    if (result?.verified !== true) throw new Error('PLAY_PURCHASE_NOT_VERIFIED');
    return result;
  }

  return {
    product,
    // Invoke directly from a click after creating the adapter/loading details;
    // do not await network I/O before PaymentRequest.show (user activation).
    async purchase() {
      if (busy) throw new Error('PLAY_BILLING_BUSY');
      busy = true;
      let response;
      let verified = false;
      try {
        const request = new browser.PaymentRequest([
          { supportedMethods: PLAY_BILLING_METHOD, data: { sku: productId } },
        ], { total: { label: product.title || 'DAYRIS PRO', amount: product.price } });
        response = await request.show();
        const result = await verify({ itemId: productId, purchaseToken: response.details?.purchaseToken });
        verified = true;
        return result;
      } finally {
        if (response) {
          // A browser UI completion failure must not turn a verified payment
          // into a reported purchase failure or invite a second payment.
          try { await response.complete(verified ? 'success' : 'fail'); } catch { /* UI only */ }
        }
        busy = false;
      }
    },
    async restore() {
      if (busy) throw new Error('PLAY_BILLING_BUSY');
      busy = true;
      try {
        const purchases = await service.listPurchases();
        const results = [];
        for (const purchase of purchases) {
          if (purchase.itemId === productId) results.push(await verify(purchase));
        }
        return results;
      } finally {
        busy = false;
      }
    },
  };
}
