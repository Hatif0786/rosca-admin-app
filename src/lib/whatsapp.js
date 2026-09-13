import { useStore } from '../store/useStore';

// Default Evolution API Server Configuration (Can be updated via store or environment)
const DEFAULT_CONFIG = {
  apiUrl: 'https://evolution-api-latest-8rfm.onrender.com', // Replace with your deployed Evolution API URL
  apiKey: 'whatsappAuthenticationApiKey',
  instanceName: 'rizqly_admin',
  enabled: true
};

/**
 * Returns true only when REAL Evolution credentials are present.
 * While the placeholder apiUrl/apiKey are still in place (i.e. Evolution
 * hasn't been deployed/wired yet), we skip sending entirely so the app
 * doesn't throw "Network request failed" against a non-existent server.
 * The moment a real apiUrl + apiKey are set in the store, sending activates.
 */
function isConfigured(config) {
  const url = (config.apiUrl || '').trim();
  const key = (config.apiKey || '').trim();
  return Boolean(
    config.enabled &&
    url && !url.includes('evolution.domain') &&
    key && key !== 'GLOBAL_API_KEY_HERE' &&
    (config.instanceName || '').trim()
  );
}

/**
 * Clean & format phone numbers to WhatsApp international format (e.g. 919876543210).
 * Handles common South-Asian input styles: leading national trunk "0" (e.g. 03001234567),
 * "+" prefixes, spaces/dashes, and numbers already carrying a country code.
 * The default country code is configurable via store `whatsappConfig.defaultCountryCode`
 * (falls back to '91').
 */
export function formatPhoneNumber(phone, defaultCountryCode = '91') {
  if (!phone) return '';
  let cleaned = String(phone).replace(/\D/g, '');
  if (!cleaned) return '';

  const cc = String(defaultCountryCode).replace(/\D/g, '') || '91';

  // Already includes a country code (more than a local 10-digit number) → use as-is.
  if (cleaned.length > 11) return cleaned;

  // National format with trunk prefix, e.g. 0300XXXXXXX (11 digits) → drop the leading 0.
  if (cleaned.length === 11 && cleaned.startsWith('0')) {
    cleaned = cleaned.slice(1);
  }

  // Bare 10-digit local number → prepend the default country code.
  if (cleaned.length === 10) {
    cleaned = cc + cleaned;
  }
  return cleaned;
}

/**
 * Detect Evolution's "recipient is not a WhatsApp user" rejection.
 * v2 returns 400 with response.message = [{ jid, exists:false, number }].
 * This is an expected outcome for test/landline numbers — not a real error.
 */
function isNumberNotOnWhatsApp(data) {
  const msg = data?.response?.message;
  if (!Array.isArray(msg)) return false;
  return msg.some(m => m && typeof m === 'object' && m.exists === false);
}

/**
 * Extract a human-readable error out of an Evolution API v2 error body.
 * v2 returns validation failures as { status, error, response: { message: [...] } }
 * where message entries can be strings OR class-validator objects.
 */
function describeApiError(data) {
  const msg = data?.response?.message ?? data?.message ?? data?.error;
  if (!msg) return 'http_error';
  if (Array.isArray(msg)) {
    return msg
      .map(m => (typeof m === 'string' ? m : JSON.stringify(m)))
      .join('; ');
  }
  if (typeof msg === 'object') return JSON.stringify(msg);
  return msg;
}

/**
 * Send a raw text message via Evolution API
 */
export async function sendWhatsAppMessage(phone, text) {
  const storeConfig = useStore.getState().whatsappConfig || {};
  const config = { ...DEFAULT_CONFIG, ...storeConfig };

  if (!isConfigured(config)) {
    console.log('[WhatsApp] Skipped — not configured yet. Set apiUrl/apiKey in the store to enable.');
    return { success: false, reason: 'not_configured' };
  }

  const number = formatPhoneNumber(phone, config.defaultCountryCode);
  if (!number) {
    console.warn('[WhatsApp Error] Invalid phone number:', phone);
    return { success: false, reason: 'invalid_number' };
  }

  try {
    const url = `${config.apiUrl.replace(/\/$/, '')}/message/sendText/${config.instanceName}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.apiKey,
      },
      body: JSON.stringify({
        number,
        text,
        delay: 1000,
        linkPreview: true
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      // Recipient simply isn't on WhatsApp (test/landline/wrong number). Expected, not a fault.
      if (isNumberNotOnWhatsApp(data)) {
        console.log(`[WhatsApp] Skipped — ${number} is not a WhatsApp user.`);
        return { success: false, reason: 'not_on_whatsapp', number };
      }
      const detail = describeApiError(data);
      console.error('[WhatsApp API Error]:', response.status, detail, JSON.stringify(data));
      return { success: false, status: response.status, error: detail, data };
    }
    console.log('[WhatsApp Sent Successfully]:', data);
    return { success: true, data };
  } catch (error) {
    console.error('[WhatsApp API Exception]:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send a Document / Media file (e.g. PDF Statement) via Evolution API
 */
export async function sendWhatsAppDocument(phone, mediaUrlOrBase64, fileName, caption = '') {
  const storeConfig = useStore.getState().whatsappConfig || {};
  const config = { ...DEFAULT_CONFIG, ...storeConfig };

  if (!isConfigured(config)) return { success: false, reason: 'not_configured' };

  const number = formatPhoneNumber(phone, config.defaultCountryCode);
  if (!number) return { success: false, reason: 'invalid_number' };

  try {
    const url = `${config.apiUrl.replace(/\/$/, '')}/message/sendMedia/${config.instanceName}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.apiKey,
      },
      body: JSON.stringify({
        number,
        mediatype: 'document',
        mimetype: 'application/pdf',
        fileName: fileName || 'Statement.pdf',
        caption: caption,
        media: mediaUrlOrBase64,
        delay: 1200
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (isNumberNotOnWhatsApp(data)) {
        console.log(`[WhatsApp] Media skipped — ${number} is not a WhatsApp user.`);
        return { success: false, reason: 'not_on_whatsapp', number };
      }
      const detail = describeApiError(data);
      console.error('[WhatsApp Media API Error]:', response.status, detail, JSON.stringify(data));
      return { success: false, status: response.status, error: detail, data };
    }
    return { success: true, data };
  } catch (error) {
    console.error('[WhatsApp Media API Exception]:', error);
    return { success: false, error: error.message };
  }
}

// ==========================================
// RIZQLY DOMAIN USE CASES
// ==========================================

/** Money formatter that never throws on undefined/NaN amounts. */
function money(amount) {
  const n = Number(amount);
  return Number.isFinite(n) ? Math.round(n).toLocaleString() : '0';
}

/**
 * USE CASE 1: Welcome new member onboarding message
 */
export async function sendWelcomeWhatsApp(memberName, phone) {
  const msg = 
    `✨ *WELCOME TO RIZQLY EXECUTIVE PLATFORM*\n\n` +
    `Assalam alaikum *${memberName}*!\n\n` +
    `You have been registered as an executive member on Rizqly ROSCA Platform.\n` +
    `You will receive automated treasury ledger updates, cycle receipts, and payout alerts directly on WhatsApp.\n\n` +
    `*Developer Credit:* Developed with ❤️ by Hatif.`;

  return await sendWhatsAppMessage(phone, msg);
}

/**
 * USE CASE 2: Send Payment Contribution Receipt
 */
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

/**
 * USE CASE 3: Send Payout Disbursement Alert
 */
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

/**
 * USE CASE 4: Send Pending Contribution Reminder
 */
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
