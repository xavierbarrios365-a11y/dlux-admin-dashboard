-- Create a table for user profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL PRIMARY KEY,
  email text,
  role text DEFAULT 'vendedor' CHECK (role IN ('admin', 'vendedor')),
  full_name text,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Set up Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile." ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile." ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Create a table for financial transactions (Income/Expenses)
CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  type text NOT NULL CHECK (type IN ('ingreso', 'egreso')),
  category text NOT NULL,
  concept text NOT NULL,
  amount numeric(12,2) NOT NULL,
  date timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_by uuid REFERENCES auth.users,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can do everything on transactions" ON public.transactions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Vendedores can view all transactions" ON public.transactions
  FOR SELECT USING (true);

CREATE POLICY "Vendedores can insert transactions (but not delete/update)" ON public.transactions
  FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Function to set role on first login (optional, but good for UX)
-- Note: You'll need to manually set one user as 'admin' in the database.
