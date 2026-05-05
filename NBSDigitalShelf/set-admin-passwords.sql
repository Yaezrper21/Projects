-- FIX LOGIN: Set passwords (SERVICE_ROLE)
-- Supabase Dashboard → SQL Editor → Paste ALL → service_role key

UPDATE auth.users 
SET encrypted_password
