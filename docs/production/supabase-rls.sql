-- ====================================================================
-- RIZQLY PRODUCTION SQL MIGRATION — ROW LEVEL SECURITY (RLS) POLICIES
-- Target: Supabase PostgreSQL
-- ====================================================================

-- 1. MEMBERS TABLE RLS
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view their own members" ON public.members;
CREATE POLICY "Admins can view their own members"
  ON public.members
  FOR SELECT
  USING (auth.uid() = admin_id);

DROP POLICY IF EXISTS "Admins can insert their own members" ON public.members;
CREATE POLICY "Admins can insert their own members"
  ON public.members
  FOR INSERT
  WITH CHECK (auth.uid() = admin_id);

DROP POLICY IF EXISTS "Admins can update their own members" ON public.members;
CREATE POLICY "Admins can update their own members"
  ON public.members
  FOR UPDATE
  USING (auth.uid() = admin_id)
  WITH CHECK (auth.uid() = admin_id);

DROP POLICY IF EXISTS "Admins can delete their own members" ON public.members;
CREATE POLICY "Admins can delete their own members"
  ON public.members
  FOR DELETE
  USING (auth.uid() = admin_id);

-- 2. COMMITTEES TABLE RLS
ALTER TABLE public.committees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view their own committees" ON public.committees;
CREATE POLICY "Admins can view their own committees"
  ON public.committees
  FOR SELECT
  USING (auth.uid() = admin_id);

DROP POLICY IF EXISTS "Admins can insert their own committees" ON public.committees;
CREATE POLICY "Admins can insert their own committees"
  ON public.committees
  FOR INSERT
  WITH CHECK (auth.uid() = admin_id);

DROP POLICY IF EXISTS "Admins can update their own committees" ON public.committees;
CREATE POLICY "Admins can update their own committees"
  ON public.committees
  FOR UPDATE
  USING (auth.uid() = admin_id)
  WITH CHECK (auth.uid() = admin_id);

DROP POLICY IF EXISTS "Admins can delete their own committees" ON public.committees;
CREATE POLICY "Admins can delete their own committees"
  ON public.committees
  FOR DELETE
  USING (auth.uid() = admin_id);

-- 3. CONTRIBUTIONS TABLE RLS
--    Security: BOTH the committee AND the member must belong to the authenticated user.
--    This prevents cross-tenant injection (e.g. attacker referencing a foreign member_id
--    from another admin's account inside their own committee).
ALTER TABLE public.contributions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view their committee contributions" ON public.contributions;
CREATE POLICY "Admins can view their committee contributions"
  ON public.contributions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.committees c
      WHERE c.id = contributions.committee_id
        AND c.admin_id = auth.uid()
    )
    AND
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.id = contributions.member_id
        AND m.admin_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can insert their committee contributions" ON public.contributions;
CREATE POLICY "Admins can insert their committee contributions"
  ON public.contributions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.committees c
      WHERE c.id = contributions.committee_id
        AND c.admin_id = auth.uid()
    )
    AND
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.id = contributions.member_id
        AND m.admin_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can update their committee contributions" ON public.contributions;
CREATE POLICY "Admins can update their committee contributions"
  ON public.contributions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.committees c
      WHERE c.id = contributions.committee_id
        AND c.admin_id = auth.uid()
    )
    AND
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.id = contributions.member_id
        AND m.admin_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.committees c
      WHERE c.id = contributions.committee_id
        AND c.admin_id = auth.uid()
    )
    AND
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.id = contributions.member_id
        AND m.admin_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can delete their committee contributions" ON public.contributions;
CREATE POLICY "Admins can delete their committee contributions"
  ON public.contributions
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.committees c
      WHERE c.id = contributions.committee_id
        AND c.admin_id = auth.uid()
    )
    AND
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.id = contributions.member_id
        AND m.admin_id = auth.uid()
    )
  );

-- 4. PAYOUTS TABLE RLS
--    Security: BOTH the committee AND the member must belong to the authenticated user.
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view their committee payouts" ON public.payouts;
CREATE POLICY "Admins can view their committee payouts"
  ON public.payouts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.committees c
      WHERE c.id = payouts.committee_id
        AND c.admin_id = auth.uid()
    )
    AND
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.id = payouts.member_id
        AND m.admin_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can insert their committee payouts" ON public.payouts;
CREATE POLICY "Admins can insert their committee payouts"
  ON public.payouts
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.committees c
      WHERE c.id = payouts.committee_id
        AND c.admin_id = auth.uid()
    )
    AND
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.id = payouts.member_id
        AND m.admin_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can update their committee payouts" ON public.payouts;
CREATE POLICY "Admins can update their committee payouts"
  ON public.payouts
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.committees c
      WHERE c.id = payouts.committee_id
        AND c.admin_id = auth.uid()
    )
    AND
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.id = payouts.member_id
        AND m.admin_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.committees c
      WHERE c.id = payouts.committee_id
        AND c.admin_id = auth.uid()
    )
    AND
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.id = payouts.member_id
        AND m.admin_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can delete their committee payouts" ON public.payouts;
CREATE POLICY "Admins can delete their committee payouts"
  ON public.payouts
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.committees c
      WHERE c.id = payouts.committee_id
        AND c.admin_id = auth.uid()
    )
    AND
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.id = payouts.member_id
        AND m.admin_id = auth.uid()
    )
  );
