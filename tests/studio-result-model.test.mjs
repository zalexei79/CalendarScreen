import test from 'node:test';
import assert from 'node:assert/strict';
import {previewSignature,previewSnapshot,canPreparePreview,projectFingerprint} from '../src/features/admin/previewModel.js';
import {EMPTY_CONFIG,normalizeConfig,configCSS} from '../src/features/admin/siteConfig.js';
test('preview snapshots are independent bounded configs, source text is never evaluated',()=>{
 const config=structuredClone(EMPTY_CONFIG);config.mobile.elements.settings={width:64};const snap=previewSnapshot(config,'/* custom */','mobile',2);config.mobile.elements.settings.width=80;
 assert.equal(snap.config.mobile.elements.settings.width,64);assert.notEqual(snap.signature,previewSignature(config,'/* custom */',2));
 assert.notEqual(snap.signature,previewSignature(snap.config,snap.css,3));assert.throws(()=>previewSnapshot({},'\0','mobile'));
});
test('push preparation requires the viewed, saved, acknowledged version',()=>{
 const snapshot=previewSnapshot(EMPTY_CONFIG,'','desktop'),input={snapshot,currentSignature:snapshot.signature,dirty:false,sourceDirty:false,reviewed:true};
 assert.equal(canPreparePreview(input),true);
 for(const patch of [{dirty:true},{sourceDirty:true},{reviewed:false},{currentSignature:'stale'},{snapshot:null}])assert.equal(canPreparePreview({...input,...patch}),false);
});
test('theme variants are an enum, inherit theme tokens and keep explicit overrides',()=>{
 const config=normalizeConfig({mobile:{elements:{settings:{emphasis:'accent'},next:{emphasis:'evil;display:none'}}}});
 assert.equal(config.mobile.elements.settings.emphasis,'accent');assert.equal(config.mobile.elements.next.emphasis,undefined);
 assert.match(configCSS(config),/var\(--pro-gold,#d5bc83\)/);assert.doesNotMatch(configCSS(config),/evil/);
 assert.match(configCSS({mobile:{elements:{settings:{emphasis:'accent',background:'#123456'}}}}),/background-color:#123456!important/);
});
test('reviewed filesystem fingerprint is order independent and detects code, HEAD and staging changes',()=>{
 const a={branch:'main',head:'old',hasStaged:false,files:[{path:'b.jsx',hash:'2'},{path:'a.jsx',hash:'1'}]};
 assert.equal(projectFingerprint(a),projectFingerprint({...a,files:[...a.files].reverse()}));
 assert.notEqual(projectFingerprint(a),projectFingerprint({...a,head:'new'}));
 assert.notEqual(projectFingerprint(a),projectFingerprint({...a,hasStaged:true}));
 assert.notEqual(projectFingerprint(a),projectFingerprint({...a,files:[{path:'b.jsx',hash:'changed'},{path:'a.jsx',hash:'1'}]}));
});
