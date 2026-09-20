import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload = await req.json().catch(() => ({}));
    const { event, instance, data } = payload;

    if (!instance || !instance.startsWith('rizqly_')) {
      console.log(`[Webhook Ignored]: Event for unknown non-Rizqly instance: ${instance}`);
      return new Response(JSON.stringify({ success: true, ignored: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Identify session row by instance_name ONLY
    const { data: sessionData, error: sessionErr } = await supabase
      .from('whatsapp_sessions')
      .select('*')
      .eq('instance_name', instance)
      .single();

    if (sessionErr || !sessionData) {
      console.log(`[Webhook Ignored]: No session found for instance: ${instance}`);
      return new Response(JSON.stringify({ success: true, ignored: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (event === 'qrcode.updated' || event === 'QRCODE_UPDATED') {
      const qrBase64 = data?.qrcode?.base64 || data?.base64 || null;
      await supabase
        .from('whatsapp_sessions')
        .update({
          qr_code: qrBase64,
          connection_status: 'connecting',
          updated_at: new Date().toISOString(),
        })
        .eq('instance_name', instance);

      console.log(`[Webhook] QR updated for instance: ${instance}`);
    }

    if (event === 'connection.update' || event === 'CONNECTION_UPDATE') {
      const state = data?.state || data?.status;
      const isConnected = state === 'open' || state === 'connected';

      if (isConnected) {
        const phone = data?.ownerJid ? data.ownerJid.split('@')[0] : sessionData.phone_number;

        await supabase
          .from('whatsapp_sessions')
          .update({
            connection_status: 'connected',
            qr_code: null,
            phone_number: phone,
            last_connected_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('instance_name', instance);

        console.log(`[Webhook] Connection opened for instance: ${instance}`);
      } else if (state === 'close' || state === 'disconnected') {
        await supabase
          .from('whatsapp_sessions')
          .update({
            connection_status: 'disconnected',
            updated_at: new Date().toISOString(),
          })
          .eq('instance_name', instance);

        console.log(`[Webhook] Connection closed for instance: ${instance}`);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[Webhook Error]:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
