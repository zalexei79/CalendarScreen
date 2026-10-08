import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
await require('esbuild').build({entryPoints:[fileURLToPath(new URL('../src/shared/lib/widgetVoiceConversation.js',import.meta.url))],outfile:fileURLToPath(new URL('../supabase/functions/widget-voice/conversation.mjs',import.meta.url)),bundle:true,format:'esm',platform:'neutral',target:'es2022',legalComments:'none'});
console.log('Widget conversation bundle updated.');
