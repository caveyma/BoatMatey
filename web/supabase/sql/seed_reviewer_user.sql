-- Create reviewer user and profile (run in Supabase SQL Editor with service role).
-- Requires: pgcrypto extension (already in boatmatey_setup.sql).
-- This script handles existing users gracefully - it will update password if user exists.

do $$
declare
  user_id uuid;
  existing_user_id uuid;
  encrypted_pw text;
begin
  -- Check if user already exists
  select id into existing_user_id
  from auth.users
  where email = 'reviewer@boatmatey.com'
  limit 1;

  if existing_user_id is not null then
    -- User exists, use existing ID and update password
    user_id := existing_user_id;
    encrypted_pw := crypt('123456A!', gen_salt('bf'));
    
    update auth.users
    set encrypted_password = encrypted_pw,
        email_confirmed_at = now(),
        updated_at = now()
    where id = user_id;
    
    -- Ensure identity exists
    if not exists (
      select 1 from auth.identities where user_id = user_id and provider = 'email'
    ) then
      insert into auth.identities (
        id,
        user_id,
        identity_data,
        provider,
        provider_id,
        last_sign_in_at,
        created_at,
        updated_at
      ) values (
        gen_random_uuid(),
        user_id,
        jsonb_build_object('sub', user_id::text, 'email', 'reviewer@boatmatey.com'),
        'email',
        user_id::text,
        now(),
        now(),
        now()
      );
    end if;
  else
    -- User doesn't exist, create new user
    user_id := gen_random_uuid();
    encrypted_pw := crypt('123456A!', gen_salt('bf'));

    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000',
      user_id,
      'authenticated',
      'authenticated',
      'reviewer@boatmatey.com',
      encrypted_pw,
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      now(),
      now(),
      '',
      '',
      '',
      ''
    );

    insert into auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) values (
      gen_random_uuid(),
      user_id,
      jsonb_build_object('sub', user_id::text, 'email', 'reviewer@boatmatey.com'),
      'email',
      user_id::text,
      now(),
      now(),
      now()
    );
  end if;

  -- Insert or update profile (handles duplicate key gracefully)
  insert into public.profiles (id, email, full_name, metadata)
  values (user_id, 'reviewer@boatmatey.com', 'Reviewer', '{}'::jsonb)
  on conflict (id) do update
  set email = excluded.email,
      full_name = excluded.full_name,
      updated_at = now();
end $$;
