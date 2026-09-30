import React, { useId, useState } from 'react';
import { ArrowDownLeft, ArrowRight, ArrowUpRight, ChartCandlestick, ChartNoAxesCombined, Check, CreditCard, Gift, RefreshCw, Wallet } from 'lucide-react';
import { getProOfferCopy } from './proOfferCopy';
import './ProPresentation.css';

// Presentation only. All account, referral and checkout actions stay with the caller.
export default function ProOffer({ language, copy, active, signedIn, referralLoading, referralCode, referralError, checkoutLoading, checkoutError, onInvite, onCheckout, onInvites, onWallet, onPlatforms }) {
  const [feature, setFeature] = useState('wallet');
  const id = useId();
  const text = getProOfferCopy(language);
  const features = [ ['wallet', Wallet, text.wallet], ['money', ChartNoAxesCombined, text.money], ['trader', ChartCandlestick, text.trader] ];
  const index = features.findIndex(([key]) => key === feature);
  const selectWithKeys = (event) => {
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % features.length;
    if (event.key === 'ArrowLeft') next = (index + features.length - 1) % features.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = features.length - 1;
    if (next === undefined) return;
    event.preventDefault();
    setFeature(features[next][0]);
    event.currentTarget.parentElement.children[next]?.focus();
  };
  const inviteLabel = !signedIn ? copy.signIn : referralCode ? text.inviteAction : referralError ? copy.retryInvite : copy.preparing;

  return <div className="pro-offer">
    <section className="pro-offer-intro">
      <h2 id="pro-offer-title">{text.title}<br /><span>{text.titleAccent}</span></h2>
      <p>{text.intro}</p>
    </section>

    <section className="pro-explorer" aria-label={text.explore}>
      <div className="pro-feature-tabs" role="tablist" aria-label={text.explore}>
        {features.map(([key, Icon, label]) => <button key={key} type="button" role="tab" id={`${id}-${key}`} aria-selected={feature === key} aria-controls={`${id}-panel`} tabIndex={feature === key ? 0 : -1} onKeyDown={selectWithKeys} onClick={() => setFeature(key)}><Icon aria-hidden="true" /><span>{label}</span></button>)}
      </div>
      <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${feature}`} tabIndex={0} className="pro-feature-panel">
        <div key={feature} className="pro-feature-layout">
          <div className="pro-feature-copy">
            <span className="pro-eyebrow">{features[index][2]} · PRO</span>
            <h3>{text[`${feature}Title`]}</h3>
            <p>{text[`${feature}Body`]}</p>
            <ul>{text[`${feature}Points`].map(point => <li key={point}><Check aria-hidden="true" />{point}</li>)}</ul>
            {active && feature === 'wallet' && <button type="button" className="pro-text-action" onClick={onWallet}>{text.openWallet}<ArrowRight aria-hidden="true" /></button>}
            {feature === 'trader' && <div className="pro-platform-guide"><article><h4>cTrader</h4><p>{text.ctraderGuide}</p></article><article><h4>MetaTrader 5</h4><p>{text.mt5Guide}</p></article>{active && onPlatforms && <button type="button" className="pro-text-action" onClick={onPlatforms}>{text.openPlatforms}<ArrowRight aria-hidden="true" /></button>}</div>}
          </div>
          <div className={`pro-example pro-example-${feature}`}>
            <p className="pro-example-label">{text.example}</p>
            {feature === 'wallet' && <>
              <div className="pro-example-heading"><Wallet aria-hidden="true" /><span>DAYRIS WALLET</span></div>
              <p className="pro-example-caption">{text.balance}</p>
              <strong className="pro-example-amount">$380<span>.00</span></strong>
              <div className="pro-example-transactions">
                <div><ArrowDownLeft aria-hidden="true" /><span>{text.received}</span><b>+$500</b></div>
                <div><ArrowUpRight aria-hidden="true" /><span>{text.spent}</span><b>−$120</b></div>
              </div>
            </>}
            {feature === 'money' && <>
              <p className="pro-example-caption">{text.expenses}</p><strong className="pro-example-amount">$120<span>.00</span></strong>
              <div className="pro-example-categories">{text.categories.map((name, i) => <div key={name}><div><span>{name}</span><b>{[60, 25, 15][i]}%</b></div><span className="pro-example-bar"><i style={{ width: `${[60, 25, 15][i]}%` }} /></span></div>)}</div>
            </>}
            {feature === 'trader' && <>
              <div className="pro-example-heading"><ChartCandlestick aria-hidden="true" /><span>EUR / USD</span></div>
              <p className="pro-example-caption">{text.tradeResult}</p><strong className="pro-example-amount pro-positive">+$48<span>.00</span></strong>
              <svg className="pro-example-curve" viewBox="0 0 240 60" aria-hidden="true"><path d="M0 52 25 46 50 49 75 30 100 36 125 20 150 27 175 12 200 17 240 4" /></svg>
              <p className="pro-example-caption">{text.tradeDetail}</p>
            </>}
          </div>
        </div>
      </div>
    </section>

    <section className="pro-offer-access" aria-label={text.choose}>
      <div className="pro-offer-section-heading"><h3>{text.choose}</h3><button type="button" className="pro-text-action" onClick={onInvites}>{copy.invitesTab}<ArrowRight aria-hidden="true" /></button></div>
      <div className="pro-access-options">
        <article className="pro-access-card pro-access-invite">
          <Gift className="pro-access-icon" aria-hidden="true" /><h4>{text.inviteTitle}</h4><p>{text.inviteBody}</p>
          <button type="button" className="pro-offer-action pro-offer-action-primary" disabled={signedIn && referralLoading} onClick={onInvite} aria-busy={signedIn && referralLoading}>{inviteLabel}<ArrowRight aria-hidden="true" /></button>
        </article>
        <article className="pro-access-card">
          <CreditCard className="pro-access-icon" aria-hidden="true" /><h4>{active ? copy.renewTitle : text.buyTitle}</h4>
          <div className="pro-offer-price"><strong>{copy.buyPrice}</strong><span>{copy.buyPeriod}</span></div>
          <p>{active ? text.renewBody : text.buyBody}</p>
          <button type="button" className="pro-offer-action" onClick={onCheckout} disabled={checkoutLoading} aria-busy={checkoutLoading}>{checkoutLoading ? copy.buyLoading : active ? text.renewAction : text.buyAction}{checkoutLoading ? <RefreshCw className="animate-spin" aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}</button>
        </article>
      </div>
      <p className={`pro-offer-payment-note ${checkoutError ? 'has-error' : ''}`} role={checkoutError ? 'alert' : undefined}>{checkoutError ? copy.buyError : copy.comingSoon}</p>
    </section>
  </div>;
}
