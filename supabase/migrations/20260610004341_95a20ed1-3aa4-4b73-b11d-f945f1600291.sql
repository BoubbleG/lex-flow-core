DROP POLICY IF EXISTS "insert own profile" ON public.users_profile;

CREATE POLICY "insert own profile" ON public.users_profile
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND role = 'member'
  );