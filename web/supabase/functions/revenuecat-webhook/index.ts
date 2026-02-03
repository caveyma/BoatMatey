/**
 * RevenueCat Webhook Handler - Supabase Edge Function
 * 
 * Handles subscription lifecycle events from RevenueCat:
 * - INITIAL_PURCHASE: New subscription
 * - RENEWAL: Subscription renewed
 * - CANCELLATION: User cancelled (may still have access until expiry)
 * - EXPIRATION: Subscription expired - DELETE USER DATA (GDPR)
 * - BILLING_ISSUE: Payment failed
 * - PRODUCT_CHANGE: User changed plan
 * - SUBSCRIBER_ALIAS: RevenueCat ID updated
 * 
 * GDPR Compliance: When subscription expires, ALL user data is deleted.
 * 
 * Setup:
 * 1. Deploy this function: supabase functions deploy revenuecat-webhook
 * 2. Set the webhook URL in RevenueCat: https://<project>.supabase.co/functions/v1/revenuecat-webhook
 * 3. Set REVENUECAT_WEBHOOK_SECRET in Supabase secrets
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// RevenueCat webhook event types
type EventType = 
  | 'INITIAL_PURCHASE'
  | 'RENEWAL'
  | 'CANCELLATION'
  | 'EXPIRATION'
  | 'BILLING_ISSUE'
  | 'PRODUCT_CHANGE'
  | 'SUBSCRIBER_ALIAS'
  | 'NON_RENEWING_PURCHASE'
  | 'SUBSCRIPTION_PAUSED'
  | 'TRANSFER'
  | 'UNCANCELLATION';

interface RevenueCatEvent {
  type: EventType;
  app_user_id: string;
  original_app_user_id?: string;
  aliases?: string[];
  product_id?: string;
  expiration_at_ms?: number;
  purchased_at_ms?: number;
  environment?: 'SANDBOX' | 'PRODUCTION';
  store?: 'APP_STORE' | 'PLAY_STORE' | 'STRIPE' | 'PROMOTIONAL';
  is_family_share?: boolean;
  takehome_percentage?: number;
  currency?: string;
  price?: number;
  price_in_purchased_currency?: number;
  subscriber_attributes?: Record<string, { value: string; updated_at_ms: number }>;
  period_type?: 'NORMAL' | 'INTRO' | 'TRIAL';
  cancel_reason?: string;
  new_product_id?: string;
}

interface RevenueCatWebhook {
  api_version: string;
  event: RevenueCatEvent;
}

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-revenuecat-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Parse the webhook payload
    const payload: RevenueCatWebhook = await req.json();
    const event = payload.event;

    console.log(`[RevenueCat Webhook] Received event: ${event.type} for user: ${event.app_user_id}`);

    // Validate webhook signature (optional but recommended)
    // const signature = req.headers.get('x-revenuecat-signature');
    // const webhookSecret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');
    // TODO: Implement signature validation if needed

    // Create Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[RevenueCat Webhook] Missing Supabase environment variables');
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Convert expiration timestamp to ISO string
    const expiresAt = event.expiration_at_ms 
      ? new Date(event.expiration_at_ms).toISOString() 
      : null;

    // Call the database function to handle the webhook
    const { data, error } = await supabase.rpc('handle_subscription_webhook', {
      p_event_type: event.type,
      p_app_user_id: event.app_user_id,
      p_product_id: event.product_id || null,
      p_expires_at: expiresAt,
      p_original_app_user_id: event.original_app_user_id || null,
    });

    if (error) {
      console.error('[RevenueCat Webhook] Database error:', error);
      
      // Log the failed webhook
      await supabase.from('webhook_logs').insert({
        event_type: event.type,
        payload: payload,
        result: { success: false, error: error.message },
      });

      return new Response(JSON.stringify({ error: 'Database error', details: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Log the successful webhook
    await supabase.from('webhook_logs').insert({
      event_type: event.type,
      payload: payload,
      result: data,
    });

    console.log(`[RevenueCat Webhook] Processed successfully:`, data);

    // When we deleted the user (EXPIRATION or CANCELLATION), also delete their storage
    const deletedUser = (event.type === 'EXPIRATION' || event.type === 'CANCELLATION') && data?.success && data?.user_id;
    if (deletedUser) {
      try {
        const userId = data.user_id as string; // UUID from delete_user_completely
        const { error: storageError } = await supabase.storage
          .from('boatmatey-attachments')
          .remove([`${userId}/`]);

        if (storageError) {
          console.log('[RevenueCat Webhook] Storage deletion note:', storageError.message);
        } else {
          console.log(`[RevenueCat Webhook] Deleted storage for user: ${userId}`);
        }
      } catch (storageErr) {
        console.log('[RevenueCat Webhook] Storage deletion skipped:', storageErr);
      }
    }

    return new Response(JSON.stringify({ success: true, result: data }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[RevenueCat Webhook] Error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error', details: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
