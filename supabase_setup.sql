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

-- Create policies for profiles
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
CREATE POLICY "Users can insert their own profile." ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
CREATE POLICY "Users can update own profile." ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Create a table for financial transactions (Income/Expenses)
CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  type text NOT NULL CHECK (type IN ('ingreso', 'egreso')),
  category text NOT NULL,
  concept text NOT NULL,
  amount numeric(12,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'USD', -- USD or BS
  exchange_rate DECIMAL(12,2) DEFAULT 1.0,
  amount_bs DECIMAL(20,2), -- Calculated amount in Bolívares
  payment_method VARCHAR(50), -- Zelle, Cash, Pago Movil, etc
  date timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_by uuid REFERENCES auth.users,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Policy: Admin can do everything on transactions
DROP POLICY IF EXISTS "Admins can do everything on transactions" ON public.transactions;
DROP POLICY IF EXISTS "Admins have full access to transactions" ON public.transactions; -- Drop new name if it exists
CREATE POLICY "Admins have full access to transactions" ON public.transactions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Policy: Vendedores can view transactions
DROP POLICY IF EXISTS "Vendedores can view all transactions" ON public.transactions;
DROP POLICY IF EXISTS "Vendedores can view transactions" ON public.transactions; -- Drop new name if it exists
CREATE POLICY "Vendedores can view transactions" ON public.transactions
  FOR SELECT USING (true);

-- Policy: Vendedores can insert transactions (Sales)
DROP POLICY IF EXISTS "Vendedores can insert transactions (but not delete/update)" ON public.transactions;
DROP POLICY IF EXISTS "Vendedores can insert transactions" ON public.transactions; -- Drop new name if it exists
CREATE POLICY "Vendedores can insert transactions" ON public.transactions
  FOR INSERT WITH CHECK (auth.uid() = created_by);

-- --- MIGRATION SECTION ---
-- Run this part ONLY if you already had the transactions table from a previous version
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'USD',
ADD COLUMN IF NOT EXISTS exchange_rate DECIMAL(12,2) DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS amount_bs DECIMAL(20,2),
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50);

-- Function to set role on first login (optional, but good for UX)
-- Note: You'll need to manually set one user as 'admin' in the database.
