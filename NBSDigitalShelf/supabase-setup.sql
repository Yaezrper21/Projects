-- NBS Digital Shelf - Supabase Schema + RLS
-- Run ALL in Supabase Dashboard → SQL Editor → New Query

-- Enable RLS on auth.users
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username text,
  email text,
  role text DEFAULT 'user' CHECK (role IN ('user', 'admin', 'super_admin')),
  contact_number text,
  address text,
  avatar_path text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS: Users see/edit own profile
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Books table
CREATE TABLE IF NOT EXISTS books (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  genre text NOT NULL,
  description text,
  cover_path text,
  created_by uuid REFERENCES profiles(id),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Public read, admin insert
CREATE POLICY "Public read books" ON books FOR SELECT USING (true);
CREATE POLICY "Admins insert books" ON books FOR INSERT WITH CHECK (exists(SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));
CREATE POLICY "Admins update books" ON books FOR UPDATE USING (exists(SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));

-- Chapters table
CREATE TABLE IF NOT EXISTS chapters (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  book_id uuid REFERENCES books(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  file_path text NOT NULL,
  is_paid boolean DEFAULT false,
  chapter_order integer DEFAULT 1,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE POLICY "Public read chapters" ON chapters FOR SELECT USING (true);
CREATE POLICY "Admins insert chapters" ON chapters FOR INSERT WITH CHECK (exists(SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));
CREATE POLICY "Admins update chapters" ON chapters FOR UPDATE USING (exists(SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id uuid REFERENCES profiles(id) NOT NULL,
  book_id uuid REFERENCES books(id),
  chapter_id uuid REFERENCES chapters(id),
  item_name text NOT NULL,
  item_type text CHECK (item_type IN ('chapter', 'book', 'topup')) NOT NULL,
  status text DEFAULT 'Pending' CHECK (status IN ('Pending', 'Purchased')),
  order_number text UNIQUE NOT NULL,
  details jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE POLICY "Users view own orders" ON orders FOR SELECT USING (auth.uid() = profile_id);

-- Favorites
CREATE TABLE IF NOT EXISTS favorites (
  profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  book_id uuid REFERENCES books(id) ON DELETE CASCADE NOT NULL,
  PRIMARY KEY (profile_id, book_id)
);

CREATE POLICY "Users manage own favorites" ON favorites FOR ALL USING (auth.uid() = profile_id);

-- Views
CREATE TABLE IF NOT EXISTS book_views (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  book_id uuid REFERENCES books(id) NOT NULL,
  viewer_id uuid REFERENCES profiles(id),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE POLICY "Public insert book views" ON book_views FOR INSERT WITH CHECK (true);

-- Announcements
CREATE TABLE IF NOT EXISTS announcements (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  created_by uuid REFERENCES profiles(id),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE POLICY "Public read announcements" ON announcements FOR SELECT USING (true);

-- Page views  
CREATE TABLE IF NOT EXISTS page_views (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  page_name text NOT NULL,
  viewer_id uuid REFERENCES profiles(id),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE POLICY "Public insert page views" ON page_views FOR INSERT WITH CHECK (true);

-- Storage buckets (public)
INSERT INTO storage.buckets (id, name, public) VALUES 
('book-covers', 'book-covers', true),
('profile-avatars', 'profile-avatars', true),
('chapter-files', 'chapter-files', true)
ON CONFLICT (id) DO NOTHING;

-- Seed demo admin + superadmin
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, raw_user_meta_data) 
VALUES 
  (gen_random_uuid(), 'admin123@nbsds.com', crypt('12345678', gen_salt('bf')), now(), now(), '{"username": "NBS Admin", "role": "admin"}'::jsonb),
  (gen_random_uuid(), 'sadmin123@nbsds.com', crypt('12345678', gen_salt('bf')), now(), now(), '{"username": "NBS Super Admin", "role": "super_admin"}'::jsonb)
ON CONFLICT DO NOTHING;

-- Ensure profiles
INSERT INTO profiles (id, email, username, role)
SELECT id, email, raw_user_meta_data->>'username', raw_user_meta_data->>'role' 
FROM auth.users 
WHERE email IN ('admin123@nbsds.com', 'sadmin123@nbsds.com')
ON CONFLICT (id) DO UPDATE SET 
  username = EXCLUDED.username,
  role = EXCLUDED.role;


-- Trigger profile upsert on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, username)
  VALUES (new.id, new.email, split_part(new.email, '@', 1))
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

