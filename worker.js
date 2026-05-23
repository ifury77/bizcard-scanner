export default {
  async fetch(request, env) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    // ── KV sync endpoints ──
    if (url.pathname === '/kv/save' && request.method === 'POST') {
      try {
        const { key, data } = await request.json();
        await env.PV_STORE.put(key, JSON.stringify(data));
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch(e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    if (url.pathname === '/kv/load' && request.method === 'GET') {
      try {
        const key = url.searchParams.get('key');
        const val = await env.PV_STORE.get(key);
        return new Response(JSON.stringify({ ok: true, data: val ? JSON.parse(val) : null }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch(e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // ── Anthropic API proxy ──
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    }

    try {
      const body = await request.json();
      const hasPDF = JSON.stringify(body).includes('"application/pdf"');
      const headers = {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      };
      if (hasPDF) headers['anthropic-beta'] = 'pdfs-2024-09-25';

      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', headers, body: JSON.stringify(body)
      });
      const data = await resp.json();
      return new Response(JSON.stringify(data), {
        status: resp.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch(err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
}
