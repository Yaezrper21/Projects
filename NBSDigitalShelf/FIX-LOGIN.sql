-- **COMPLETE** - COPY ALL TO SUPABASE SQL EDITOR
-- Dashboard → SQL → service_role → RUN

UPDATE auth.users 
SET encrypted_password = crypt('12345678',
