// The untrusted child is deliberately NOT same-origin. Never give it an auth/data bridge.
function contentDocument(feature, channel) {
  const nonce = crypto.randomUUID().replaceAll('-', '');
  const script = source => `<script nonce="${nonce}">${source.replace(/<\/script/gi, '<\\/script')}</script>`;
  const bootstrap = `(()=>{const channel = ${JSON.stringify(channel)};
const send = (action, value) => parent.postMessage({type:'dayris:extension',channel,action,value:typeof value==='string'?value.slice(0,2048):''}, '*');
window.dayris = Object.freeze({notify:text=>send('notify',String(text)),navigate:url=>send('navigate',String(url)),close:()=>send('close','')});
addEventListener('error',event=>send('error',event.message));
addEventListener('unhandledrejection',event=>send('error',String(event.reason)));
addEventListener('keydown',event=>{if(event.key==='Escape')dayris.close();});
document.addEventListener('click',event=>{const link=event.target.closest?.('a');if(link){event.preventDefault();dayris.navigate(link.getAttribute('href')||'');}},true);
document.addEventListener('submit',event=>event.preventDefault(),true);})();`;
  const policy = `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; font-src 'none'; media-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`;
  // Code and markup never enter the parent DOM. CSP precedes all owner-provided content.
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${policy}">${script(bootstrap)}<style>${feature.css.replace(/<\/style/gi, '<\\/style')}</style></head><body>${feature.html}${script(feature.js)}</body></html>`;
}

export function sandboxDocument(feature, channel) {
  // The trusted wrapper restricts the child's own navigations as well.
  // A CSP only inside the untrusted document would not block location.href exfiltration.
  const child = contentDocument(feature, channel).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
  const policy = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; frame-src about:; connect-src 'none'; img-src 'none'; base-uri 'none'; form-action 'none'";
  const relay = `const child=document.querySelector('iframe');addEventListener('message',event=>{if(event.source===child.contentWindow&&event.origin==='null'&&event.data?.type==='dayris:extension'&&event.data.channel===${JSON.stringify(channel)})parent.postMessage(event.data,'*');});`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${policy}"><style>html,body{margin:0;height:100%;overflow:hidden}iframe{width:100%;height:100%;border:0}</style></head><body><iframe title="Содержимое функции" sandbox="allow-scripts" referrerpolicy="no-referrer" allow="camera 'none'; microphone 'none'; geolocation 'none'" srcdoc="${child}"></iframe><script>${relay}</script></body></html>`;
}
