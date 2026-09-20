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

    const { data: sessionData } = await supabase
      .from('whatsapp_sessions')
      .select('*')
      .eq('admin_id', adminId)
      .single();

    if (action === 'createInstance' || action === 'connect') {
      const webhookUrl = `${supabaseUrl}/functions/v1/whatsapp-webhook`;
      
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
          webhook: {
            enabled: true,
            url: webhookUrl,
            byEvents: false,
            base64: true,
            events: ['QRCODE_UPDATED', 'CONNECTION_UPDATE']
          }
        }),
      });
      const data = await resp.json();

      let qrBase64 = data.qrcode?.base64 || null;

      // Fallback: connect endpoint if QR not returned in create
      if (!qrBase64) {
        const connResp = await fetch(`${EVOLUTION_API_URL}/instance/connect/${instanceName}`, {
          headers: { 'apikey': EVOLUTION_API_KEY ?? '' }
        });
        const connData = await connResp.json().catch(() => ({}));
        qrBase64 = connData.base64 || connData.qrcode?.base64 || null;
      }

      const upsertData = {
        admin_id: adminId,
        instance_name: instanceName,
        connection_status: 'connecting',
        qr_code: qrBase64,
        updated_at: new Date().toISOString(),
      };

      await supabase.from('whatsapp_sessions').upsert(upsertData);

      return new Response(JSON.stringify({ success: true, instanceName, connection_status: 'connecting', qr_code: qrBase64 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'getState') {
      const stateResp = await fetch(`${EVOLUTION_API_URL}/instance/connectionState/${instanceName}`, {
        headers: { 'apikey': EVOLUTION_API_KEY ?? '' }
      });
      const stateData = await stateResp.json().catch(() => ({}));
      const state = stateData.instance?.state || sessionData?.connection_status || 'disconnected';

      return new Response(JSON.stringify({ success: true, state, session: sessionData }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'logout' || action === 'disconnect') {
      await fetch(`${EVOLUTION_API_URL}/instance/logout/${instanceName}`, {
        method: 'DELETE',
        headers: { 'apikey': EVOLUTION_API_KEY ?? '' }
      });

      await supabase.from('whatsapp_sessions').update({
        connection_status: 'disconnected',
        qr_code: null,
        phone_number: null,
        updated_at: new Date().toISOString()
      }).eq('admin_id', adminId);

      return new Response(JSON.stringify({ success: true, connection_status: 'disconnected' }), {
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
