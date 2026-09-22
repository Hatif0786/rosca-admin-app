import { supabase } from './supabase';

/**
 * Fetch the authenticated admin's WhatsApp session row.
 */
export async function fetchWhatsAppSession() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('whatsapp_sessions')
    .select('*')
    .eq('admin_id', user.id)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('[WhatsApp Session Error]:', error);
  }
  return data || { connection_status: 'disconnected' };
}

/**
 * Trigger connect/create WhatsApp instance for authenticated admin.
 * If Supabase Edge Functions or a dedicated proxy is deployed, calls that endpoint.
 * Otherwise fallback directly to Supabase client table row upsert for status tracking.
 */
export async function connectWhatsAppSession() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { connection_status: 'disconnected', error: 'Not authenticated' };

  const instanceName = `rizqly_${user.id.replace(/-/g, '_')}`;

  try {
    // 15-second timeout controller specifically for Edge Function invocation
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const { data, error } = await supabase.functions.invoke('whatsapp-service', {
      body: { action: 'connect' },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (error) {
      console.error('[WhatsApp Connect Edge Function Error]:', error.message);
      // Fallback query to fetch existing session if edge function had an issue
      const session = await fetchWhatsAppSession();
      return session?.qr_code
        ? session
        : { connection_status: 'disconnected', error: error.message };
    }

    if (data && data.success) {
      return {
        admin_id: user.id,
        instance_name: data.instanceName || instanceName,
        connection_status: data.connection_status || 'connecting',
        qr_code: data.qr_code || null,
      };
    }

    const currentSession = await fetchWhatsAppSession();
    return currentSession || { connection_status: 'disconnected', error: 'Failed to generate QR code' };
  } catch (err) {
    console.error('[WhatsApp Connect Exception]:', err.message || err);
    const fallbackSession = await fetchWhatsAppSession();
    return fallbackSession?.qr_code
      ? fallbackSession
      : { connection_status: 'disconnected', error: err.name === 'AbortError' ? 'Connection timed out' : err.message };
  }
}

/**
 * Check the connection status of the authenticated admin's WhatsApp instance.
 * Calls Edge Function with { action: 'getState' }.
 */
export async function checkWhatsAppStatus() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { connection_status: 'disconnected', error: 'Not authenticated' };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const { data, error } = await supabase.functions.invoke('whatsapp-service', {
      body: { action: 'getState' },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (error) {
      console.error('[WhatsApp Status Edge Function Error]:', error.message);
      const session = await fetchWhatsAppSession();
      return session || { connection_status: 'disconnected', error: error.message };
    }

    // Always refresh latest session from database after status check
    const session = await fetchWhatsAppSession();
    if (data && data.success && data.state) {
      const normalizedStatus = (data.state === 'open' || data.state === 'connected') ? 'connected' : session?.connection_status || 'disconnected';
      return {
        ...session,
        connection_status: normalizedStatus,
      };
    }

    return session || { connection_status: 'disconnected' };
  } catch (err) {
    console.error('[WhatsApp Check Status Exception]:', err.message || err);
    const fallbackSession = await fetchWhatsAppSession();
    return fallbackSession || { connection_status: 'disconnected', error: err.name === 'AbortError' ? 'Status check timed out' : err.message };
  }
}

/**
 * Generate a WhatsApp pairing code for the authenticated admin's WhatsApp instance.
 * Calls Edge Function with { action: 'getPairingCode', number }.
 */
export async function getWhatsAppPairingCode(phone) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const formattedNumber = formatPhoneNumber(phone);
  if (!formattedNumber) return { success: false, error: 'Invalid phone number format. Please enter a valid number with country code.' };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const { data, error } = await supabase.functions.invoke('whatsapp-service', {
      body: { action: 'getPairingCode', number: formattedNumber },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (error) {
      console.warn('[WhatsApp Pairing Code Edge Function Error]:', error.message);
      let detailMsg = error.message;
      try {
        if (error.context && typeof error.context.json === 'function') {
          const errBody = await error.context.json();
          if (errBody && errBody.error) {
            detailMsg = errBody.error;
          }
        }
      } catch (_) {}
      return { success: false, error: detailMsg };
    }

    if (data && data.success && data.pairingCode) {
      return {
        success: true,
        pairingCode: data.pairingCode,
        instanceName: data.instanceName,
      };
    }

    return {
      success: false,
      error: data?.error || 'Failed to generate pairing code. Please try again.',
    };
  } catch (err) {
    console.error('[WhatsApp Pairing Code Exception]:', err.message || err);
    return {
      success: false,
      error: err.name === 'AbortError' ? 'Pairing code request timed out' : err.message,
    };
  }
}

/**
 * Disconnect/logout WhatsApp instance for authenticated admin.
 */
export async function disconnectWhatsAppSession() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { error } = await supabase
    .from('whatsapp_sessions')
    .update({
      connection_status: 'disconnected',
      qr_code: null,
      phone_number: null,
      updated_at: new Date().toISOString(),
    })
    .eq('admin_id', user.id);

  if (error) {
    console.error('[WhatsApp Disconnect Error]:', error);
    return false;
  }
  return true;
}

/**
 * Format phone number to WhatsApp international format.
 */
export function formatPhoneNumber(phone, defaultCountryCode = '91') {
  if (!phone) return '';
  let cleaned = String(phone).replace(/\D/g, '');
  if (!cleaned) return '';

  const cc = String(defaultCountryCode).replace(/\D/g, '') || '91';

  if (cleaned.length > 11) return cleaned;
  if (cleaned.length === 11 && cleaned.startsWith('0')) {
    cleaned = cleaned.slice(1);
  }
  if (cleaned.length === 10) {
    cleaned = cc + cleaned;
  }
  return cleaned;
}

/**
 * Money helper for message templates.
 */
function money(amount) {
  const n = Number(amount);
  return Number.isFinite(n) ? Math.round(n).toLocaleString() : '0';
}

/**
 * Send a raw text message using authenticated admin's dedicated instance.
 */
export async function sendWhatsAppMessage(phone, text) {
  const session = await fetchWhatsAppSession();
  if (!session || session.connection_status !== 'connected') {
    console.log('[WhatsApp] Skipped sending — WhatsApp instance is not connected for this admin.');
    return { success: false, reason: 'not_connected' };
  }

  const number = formatPhoneNumber(phone);
  if (!number) return { success: false, reason: 'invalid_number' };

  // Production Edge Function / API invocation routing
  try {
    const { data: { session: authSession } } = await supabase.auth.getSession();
    if (!authSession) return { success: false, reason: 'not_authenticated' };

    // Invoke Supabase edge function 'whatsapp-service' if deployed
    const { data, error } = await supabase.functions.invoke('whatsapp-service', {
      body: { action: 'sendText', number, text }
    });

    if (error) {
      console.log('[WhatsApp Edge Function Fallback]:', error.message);
      return { success: false, error: error.message };
    }
    return data || { success: true };
  } catch (err) {
    console.error('[WhatsApp Send Exception]:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Send a PDF / Document file using authenticated admin's dedicated instance.
 */
export async function sendWhatsAppDocument(phone, mediaUrlOrBase64, fileName, caption = '') {
  const session = await fetchWhatsAppSession();
  if (!session || session.connection_status !== 'connected') {
    return { success: false, reason: 'not_connected' };
  }

  const number = formatPhoneNumber(phone);
  if (!number) return { success: false, reason: 'invalid_number' };

  try {
    const { data, error } = await supabase.functions.invoke('whatsapp-service', {
      body: { action: 'sendMedia', number, media: mediaUrlOrBase64, fileName, caption }
    });
    if (error) return { success: false, error: error.message };
    return data || { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ==========================================
// RIZQLY DOMAIN USE CASES
// ==========================================

export async function sendWelcomeWhatsApp(memberName, phone) {
  const msg = 
    `✨ *WELCOME TO RIZQLY EXECUTIVE PLATFORM*\n\n` +
    `Assalam alaikum *${memberName}*!\n\n` +
    `You have been registered as an executive member on Rizqly ROSCA Platform.\n` +
    `You will receive automated treasury ledger updates, cycle receipts, and payout alerts directly on WhatsApp.`;

  return await sendWhatsAppMessage(phone, msg);
}

export async function sendPaymentReceiptWhatsApp(memberName, phone, committeeName, cycleNumber, amount) {
  const msg = 
    `🧾 *RIZQLY OFFICIAL PAYMENT RECEIPT*\n\n` +
    `Assalam alaikum *${memberName}*,\n\n` +
    `We have received your contribution payment:\n` +
    `• *Committee:* ${committeeName}\n` +
    `• *Cycle:* #${cycleNumber}\n` +
    `• *Amount Paid:* ₹${money(amount)}\n` +
    `• *Status:* PAID & VERIFIED ✅\n\n` +
    `Thank you for maintaining transparent treasury records.`;

  return await sendWhatsAppMessage(phone, msg);
}

export async function sendPayoutDisbursementWhatsApp(memberName, phone, committeeName, cycleNumber, amount) {
  const msg = 
    `🏛️ *RIZQLY TREASURY PAYOUT DISBURSED*\n\n` +
    `Assalam alaikum *${memberName}*!\n\n` +
    `Congratulations! Your committee payout has been disbursed:\n` +
    `• *Committee:* ${committeeName}\n` +
    `• *Cycle:* #${cycleNumber}\n` +
    `• *Disbursed Amount:* ₹${money(amount)}\n` +
    `• *Treasury Status:* COMPLETED 🏆\n\n` +
    `May Allah bless your earnings and investments!`;

  return await sendWhatsAppMessage(phone, msg);
}

export async function sendContributionReminderWhatsApp(memberName, phone, committeeName, cycleNumber, amountDue) {
  const msg = 
    `⏰ *RIZQLY PAYMENT DUE REMINDER*\n\n` +
    `Assalam alaikum *${memberName}*,\n\n` +
    `This is a gentle reminder regarding your pending committee contribution:\n` +
    `• *Committee:* ${committeeName}\n` +
    `• *Cycle:* #${cycleNumber}\n` +
    `• *Amount Due:* ₹${money(amountDue)}\n\n` +
    `Please clear your payment to keep the committee schedule on track.`;

  return await sendWhatsAppMessage(phone, msg);
}
