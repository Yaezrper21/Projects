-- QUICK FIX: Orders table column error
-- Run in Supabase SQL Editor

-- Drop broken orders (if exists)
DROP TABLE IF EXISTS orders CASCADE;

-- Recreate orders correctly
CREATE TABLE orders (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  book_id uuid REFERENCES books(id),
  chapter_id uuid REFERENCES chapters(id),
  item_name text NOT NULL,
  item_type text CHECK (item_type IN ('chapter', 'book', 'topup')) NOT NULL,
  status text DEFAULT 'Pending' CHECK (status IN ('Pending', 'Purchased')),
  order_number text UNIQUE NOT NULL,
  details jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS
CREATE POLICY "Users view own orders" ON orders FOR SELECT USING (auth.uid() = profile_id);
CREATE POLICY "Users insert own orders" ON orders FOR INSERT WITH CHECK (auth.uid() = profile_id);

-- Test login now works!

