/**
 * Validate Promo Code - Supabase Edge Function (no auth required)
 *
 * POST only. Body: { "code": "CAPTAINMIKE" }
 * Validates that the code exists, is active, within dates, and has uses left.
 * Does NOT create any user or redemption; use redeem-promo after account creation.
 *
 * Rate limiting: client should debounce (e.g. 400ms). For server-side rate limiting,
 * configure Supabase Edge Function rate limits or use an external service.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const DURATION_LABELS: Record<string, string> = {
  day_1: '1 day',
  month_1: '30 days',
  month_12: '12 months',
  lifetime: 'Lifetime',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({ valid: false, error: 'Server configuration error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  let body: { code?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ valid: false, error: 'Invalid JSON body' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const code =
    typeof body?.code === 'string'
      ? body.code.trim().toUpperCase().replace(/\s+/g, '')
      : '';
  if (!code) {
    return new Response(
      JSON.stringify({ valid: false, error: 'Missing or invalid code' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const now = new Date().toISOString();

  const { data: promo, error: promoError } = await supabase
    .from('promo_codes')
    .select('id, code, promo_type, max_uses, uses, is_active, starts_at, expires_at')
    .eq('code', code)
    .maybeSingle();

  if (promoError) {
    console.error('[validate-promo] select error:', promoError);
    return new Response(
      JSON.stringify({ valid: false, error: 'Failed to validate code' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!promo) {
    return new Response(
      JSON.stringify({ valid: false, error: 'Invalid or expired code' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!promo.is_active) {
    return new Response(
      JSON.stringify({ valid: false, error: 'This code is no longer active' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (promo.uses >= promo.max_uses) {
    return new Response(
      JSON.stringify({ valid: false, error: 'This code has reached its redemption limit' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (promo.starts_at && promo.starts_at > now) {
    return new Response(
      JSON.stringify({ valid: false, error: 'This code is not yet valid' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (promo.expires_at && promo.expires_at < now) {
    return new Response(
      JSON.stringify({ valid: false, error: 'This code has expired' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const durationLabel = DURATION_LABELS[promo.promo_type] ?? promo.promo_type;
  return new Response(
    JSON.stringify({
      valid: true,
      promo_type: promo.promo_type,
      duration_label: durationLabel,
      code: promo.code,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
