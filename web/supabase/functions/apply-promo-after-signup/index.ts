/**
 * Apply Promo After Signup - Supabase Edge Function (no JWT)
 *
 * Called by the web app right after signUp when the user may not have a session yet
 * (e.g. email confirmation required). Applies the promo to the profile so access
 * is recorded immediately.
 *
 * POST only. No auth. Body: { "user_id": "uuid", "code": "FRIEND1" }
 * Only applies if the profile was updated in the last 3 minutes and has no promo yet.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const LIFETIME_END = '2099-12-31T23:59:59Z';
const SIGNUP_WINDOW_MINUTES = 3;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type PromoType = 'day_1' | 'month_1' | 'month_12' | 'lifetime';

function grantedUntilFromType(promoType: PromoType, fromDate: Date): string {
  const from = fromDate.getTime();
  if (promoType === 'day_1') {
    const d = new Date(from);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString();
  }
  if (promoType === 'month_1') {
    const d = new Date(from);
    d.setUTCDate(d.getUTCDate() + 30);
    return d.toISOString();
  }
  if (promoType === 'month_12') {
    const d = new Date(from);
    d.setUTCDate(d.getUTCDate() + 365);
    return d.toISOString();
  }
  return LIFETIME_END;
}

function isValidUuid(s: string): boolean {
  const u = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return u.test(s);
}

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
      JSON.stringify({ error: 'Server configuration error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  let body: { user_id?: string; code?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const userId = typeof body?.user_id === 'string' ? body.user_id.trim() : '';
  const code = typeof body?.code === 'string'
    ? body.code.trim().toUpperCase().replace(/\s+/g, '')
    : '';

  if (!isValidUuid(userId)) {
    return new Response(
      JSON.stringify({ error: 'Invalid user_id' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  if (!code) {
    return new Response(
      JSON.stringify({ error: 'Missing or invalid code' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const now = new Date();
  const nowIso = now.toISOString();
  const windowStart = new Date(now.getTime() - SIGNUP_WINDOW_MINUTES * 60 * 1000);

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, updated_at, promo_access_until, subscription_expires_at, subscription_status, affiliate_code')
    .eq('id', userId)
    .maybeSingle();

  if (profileError) {
    console.error('[apply-promo-after-signup] profile select error:', profileError);
    return new Response(
      JSON.stringify({ error: 'Failed to load profile' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!profile) {
    return new Response(
      JSON.stringify({ error: 'Profile not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const updatedAt = profile.updated_at ? new Date(profile.updated_at) : null;
  if (!updatedAt || updatedAt < windowStart) {
    return new Response(
      JSON.stringify({ error: 'Apply promo only right after signup' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { data: promo, error: promoError } = await supabase
    .from('promo_codes')
    .select('id, code, promo_type, max_uses, uses, is_active, starts_at, expires_at, allow_multiple_per_user')
    .eq('code', code)
    .maybeSingle();

  if (promoError) {
    console.error('[apply-promo-after-signup] promo_codes select error:', promoError);
    return new Response(
      JSON.stringify({ error: 'Failed to validate code' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!promo) {
    return new Response(
      JSON.stringify({ error: 'Invalid or expired code' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!promo.is_active) {
    return new Response(
      JSON.stringify({ error: 'This code is no longer active' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (promo.uses >= promo.max_uses) {
    return new Response(
      JSON.stringify({ error: 'This code has reached its redemption limit' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (promo.starts_at && new Date(promo.starts_at) > now) {
    return new Response(
      JSON.stringify({ error: 'This code is not yet valid' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (promo.expires_at && new Date(promo.expires_at) < now) {
    return new Response(
      JSON.stringify({ error: 'This code has expired' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const allowMultiplePerUser = promo.allow_multiple_per_user === true;

  if (!allowMultiplePerUser) {
    const { data: existingRedemption } = await supabase
      .from('promo_redemptions')
      .select('id')
      .eq('user_id', userId)
      .eq('promo_code_id', promo.id)
      .maybeSingle();

    if (existingRedemption) {
      return new Response(
        JSON.stringify({ error: 'You have already redeemed this code' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  const existingUntil = profile.promo_access_until ? new Date(profile.promo_access_until) : null;
  const startFrom = existingUntil && existingUntil > now ? existingUntil : now;
  const grantedUntil = grantedUntilFromType(promo.promo_type as PromoType, startFrom);
  const grantedUntilDate = new Date(grantedUntil);

  const existingAffiliate = profile.affiliate_code ?? null;
  const setAffiliateCode = existingAffiliate == null ? promo.code : existingAffiliate;
  const setAffiliateAt = existingAffiliate == null ? nowIso : undefined;

  const subExpiresAt = profile.subscription_expires_at ? new Date(profile.subscription_expires_at) : null;
  const paidActive = profile.subscription_status === 'active' && (!subExpiresAt || subExpiresAt > now);
  const promoActive = grantedUntilDate > now;
  const isActive = paidActive || promoActive;
  const accessUntil = [subExpiresAt, grantedUntilDate].filter(Boolean).sort((a, b) => (b as Date).getTime() - (a as Date).getTime())[0];
  const accessUntilIso = accessUntil ? (accessUntil as Date).toISOString() : grantedUntil;

  const updatePayload: Record<string, unknown> = {
    promo_access_until: grantedUntil,
    promo_source: `promo:${promo.code}`,
    access_until: accessUntilIso,
    is_active: isActive,
    updated_at: nowIso,
  };
  if (setAffiliateAt !== undefined) {
    updatePayload.affiliate_code = setAffiliateCode;
    updatePayload.affiliate_assigned_at = setAffiliateAt;
  }

  const { error: updateError } = await supabase
    .from('profiles')
    .update(updatePayload)
    .eq('id', userId);

  if (updateError) {
    console.error('[apply-promo-after-signup] profile update error:', updateError);
    return new Response(
      JSON.stringify({ error: 'Failed to apply code' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (allowMultiplePerUser) {
    await supabase.from('promo_redemptions').upsert(
      {
        user_id: userId,
        promo_code_id: promo.id,
        granted_until: grantedUntil,
        redeemed_at: nowIso,
      },
      { onConflict: 'user_id,promo_code_id' }
    );
  } else {
    await supabase.from('promo_redemptions').insert({
      user_id: userId,
      promo_code_id: promo.id,
      granted_until: grantedUntil,
    });
  }

  await supabase.from('promo_codes').update({ uses: promo.uses + 1 }).eq('id', promo.id);

  return new Response(
    JSON.stringify({
      success: true,
      access_until: grantedUntil,
      message: `Access granted until ${grantedUntilDate.toLocaleDateString(undefined, { dateStyle: 'long' })}`,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
