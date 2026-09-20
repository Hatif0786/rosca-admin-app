-- ====================================================================
-- RIZQLY MULTI-TENANT WHATSAPP INTEGRATION MIGRATION
-- Target: Supabase PostgreSQL
-- ====================================================================

-- 1. Create whatsapp_sessions table
CREATE TABLE IF NOT EXISTS public.whatsapp_sessions (
  admin_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  instance_name TEXT NOT NULL UNIQUE,
  connection_status TEXT NOT NULL DEFAULT 'disconnected' 
    CHECK (connection_status IN ('disconnected', 'connecting', 'connected', 'error')),
  phone_number TEXT NULL,
  qr_code TEXT NULL,
  last_connected_at TIMESTAMPTZ NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.whatsapp_sessions ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies (Strict Multi-Tenant Isolation)
DROP POLICY IF EXISTS "Admins can view their own whatsapp session" ON public.whatsapp_sessions;
CREATE POLICY "Admins can view their own whatsapp session"
  ON public.whatsapp_sessions
  FOR SELECT
  USING (auth.uid() = admin_id);

DROP POLICY IF EXISTS "Admins can insert their own whatsapp session" ON public.whatsapp_sessions;
CREATE POLICY "Admins can insert their own whatsapp session"
  ON public.whatsapp_sessions
  FOR INSERT
  WITH CHECK (auth.uid() = admin_id);

DROP POLICY IF EXISTS "Admins can update their own whatsapp session" ON public.whatsapp_sessions;
CREATE POLICY "Admins can update their own whatsapp session"
  ON public.whatsapp_sessions
  FOR UPDATE
  USING (auth.uid() = admin_id)
  WITH CHECK (auth.uid() = admin_id);

DROP POLICY IF EXISTS "Admins can delete their own whatsapp session" ON public.whatsapp_sessions;
CREATE POLICY "Admins can delete their own whatsapp session"
  ON public.whatsapp_sessions
  FOR DELETE
  USING (auth.uid() = admin_id);
