-- COPY PASTE ALL to Supabase SQL Editor (service_role key required)
-- Dashboard → New Query → Paste → RUN

UPDATE auth.users 
SET encrypted_password = crypt('12345678', gen_salt('bf'))
WHERE email = 'admin123@nbsds.com';

UPDATE auth.users 
SET encrypted_password
