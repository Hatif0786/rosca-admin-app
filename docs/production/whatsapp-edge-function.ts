import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL') || 'https://evolution-api-latest-8rfm.onrender.com';
const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized user' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminId = user.id;
    const instanceName = `rizqly_${adminId.replace(/-/g, '_')}`;
    const body = await req.json().catch(() => ({}));
    const { action, number, text, media, fileName, caption } = body;

    // Verify session row in DB
    const { data: sessionData } = await supabase
      .from('whatsapp_sessions')
      .select('*')
      .eq('admin_id', adminId)
      .single();

    if (action === 'createInstance') {
      const resp = await fetch(`${EVOLUTION_API_URL}/instance/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': EVOLUTION_API_KEY ?? '',
        },
        body: JSON.stringify({
          instanceName,
          qrcode: true,
          integration: 'WHATSAPP-BAILEYS',
        }),
      });
      const data = await resp.json();

      await supabase.from('whatsapp_sessions').upsert({
        admin_id: adminId,
        instance_name: instanceName,
        connection_status: 'connecting',
        qr_code: data.qrcode?.base64 || null,
        updated_at: new Date().toISOString(),
      });

      return new Response(JSON.stringify({ success: true, instanceName, data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'sendText') {
      if (!sessionData || sessionData.connection_status !== 'connected') {
        return new Response(JSON.stringify({ success: false, reason: 'not_connected' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const resp = await fetch(`${EVOLUTION_API_URL}/message/sendText/${instanceName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': EVOLUTION_API_KEY ?? '',
        },
        body: JSON.stringify({
          number,
          text,
          delay: 1000,
          linkPreview: true,
        }),
      });
      const data = await resp.json();

      return new Response(JSON.stringify({ success: resp.ok, data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'sendMedia') {
      if (!sessionData || sessionData.connection_status !== 'connected') {
        return new Response(JSON.stringify({ success: false, reason: 'not_connected' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const resp = await fetch(`${EVOLUTION_API_URL}/message/sendMedia/${instanceName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': EVOLUTION_API_KEY ?? '',
        },
        body: JSON.stringify({
          number,
          mediatype: 'document',
          mimetype: 'application/pdf',
          fileName: fileName || 'Statement.pdf',
          caption,
          media,
          delay: 1200,
        }),
      });
      const data = await resp.json();

      return new Response(JSON.stringify({ success: resp.ok, data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
