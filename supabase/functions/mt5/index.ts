// Retired paid cloud integration. Never calls MetaApi or provisions resources.
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};
Deno.serve(request => request.method === 'OPTIONS'
  ? new Response('ok', { headers })
  : new Response(JSON.stringify({ error: 'CLOUD_DISABLED', message: 'Use the free DAYRIS Windows MT5 companion.' }), { status: 410, headers }));
