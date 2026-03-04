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
  FOR UPDATE USING (auth.uid() = id OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

-- --- Products Table (Detailed) ---
CREATE TABLE IF NOT EXISTS public.products (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  sku TEXT UNIQUE,
  description TEXT,
  price DECIMAL(12,2) NOT NULL,
  cost_price DECIMAL(12,2) DEFAULT 0,
  stock INTEGER DEFAULT 0,
  brand TEXT,
  color TEXT,
  size TEXT,
  gender TEXT DEFAULT 'Unisex' CHECK (gender IN ('Woman', 'Men', 'Unisex')),
  category TEXT,
  image_url TEXT,
  images TEXT[],
  status TEXT DEFAULT 'active',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view products" ON public.products;
CREATE POLICY "Public can view products" ON public.products FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins can manage products" ON public.products;
CREATE POLICY "Admins can manage products" ON public.products FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

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
  payment_status TEXT DEFAULT 'completed' CHECK (payment_status IN ('completed', 'pending', 'partial')),
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

-- --- Credits Table ---
CREATE TABLE IF NOT EXISTS public.credits (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_name TEXT NOT NULL,
  total_amount DECIMAL(12,2) NOT NULL,
  remaining_amount DECIMAL(12,2) NOT NULL,
  due_date DATE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue')),
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_by uuid REFERENCES auth.users
);

ALTER TABLE public.credits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins/Vendedores can view credits" ON public.credits;
CREATE POLICY "Admins/Vendedores can view credits" ON public.credits FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins can manage credits" ON public.credits;
CREATE POLICY "Admins can manage credits" ON public.credits FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- --- Payroll (Nómina) Table ---
CREATE TABLE IF NOT EXISTS public.payroll (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_name TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  payment_date DATE DEFAULT CURRENT_DATE,
  period_start DATE,
  period_end DATE,
  payment_method TEXT,
  notes TEXT,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_by uuid REFERENCES auth.users
);

ALTER TABLE public.payroll ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage payroll" ON public.payroll;
CREATE POLICY "Admins can manage payroll" ON public.payroll FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- --- MIGRATION SECTION ---
-- Run this part ONLY if you already had the transactions table from a previous version
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'USD',
ADD COLUMN IF NOT EXISTS exchange_rate DECIMAL(12,2) DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS amount_bs DECIMAL(20,2),
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50),
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'completed',
ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL;

ALTER TABLE public.credits
ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL;

-- --- Migration for Detailed Products ---
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS gender TEXT DEFAULT 'Unisex' CHECK (gender IN ('Woman', 'Men', 'Unisex'));

-- Migración para transacciones con justificación
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS exit_reason TEXT,
ADD COLUMN IF NOT EXISTS received_by TEXT;

-- Migración para sistema de cuotas en Créditos
ALTER TABLE public.credits
ADD COLUMN IF NOT EXISTS installments INT DEFAULT 1,
ADD COLUMN IF NOT EXISTS payment_cycle TEXT DEFAULT 'mensual';

-- Function to set role on first login (optional, but good for UX)
-- Note: You'll need to manually set one user as 'admin' in the database.

-- --- Financial RPCs ---
CREATE OR REPLACE FUNCTION get_total_income()
RETURNS DECIMAL AS $$
BEGIN
  RETURN (SELECT COALESCE(SUM(amount), 0) FROM public.transactions WHERE type = 'ingreso');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_total_expenses()
RETURNS DECIMAL AS $$
BEGIN
  RETURN (SELECT COALESCE(SUM(amount), 0) FROM public.transactions WHERE type = 'egreso');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- --- Profile Auto-Creation ---
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (new.id, new.email, 'admin'); -- Default to admin for the first users/owner
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
