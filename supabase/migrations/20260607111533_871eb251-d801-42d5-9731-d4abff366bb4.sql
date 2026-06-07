
-- Seed demo organization (fixed UUID for dev mode bypass)
INSERT INTO public.organizations (id, name, plan)
VALUES ('00000000-0000-0000-0000-0000000000a1', 'Escritório Demo', 'free')
ON CONFLICT (id) DO NOTHING;

-- Grant anon role basic table access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cases TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_movements TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO anon;
GRANT SELECT, INSERT ON public.cnj_query_logs TO anon;
GRANT SELECT, UPDATE ON public.organizations TO anon;

-- Permissive policies for the demo org (DEV ONLY)
DO $$
DECLARE
  demo_id uuid := '00000000-0000-0000-0000-0000000000a1';
BEGIN
  -- clients
  EXECUTE format($p$CREATE POLICY "dev anon clients" ON public.clients FOR ALL TO anon USING (organization_id = '%s') WITH CHECK (organization_id = '%s')$p$, demo_id, demo_id);
  EXECUTE format($p$CREATE POLICY "dev anon cases" ON public.cases FOR ALL TO anon USING (organization_id = '%s') WITH CHECK (organization_id = '%s')$p$, demo_id, demo_id);
  EXECUTE format($p$CREATE POLICY "dev anon case_movements" ON public.case_movements FOR ALL TO anon USING (organization_id = '%s') WITH CHECK (organization_id = '%s')$p$, demo_id, demo_id);
  EXECUTE format($p$CREATE POLICY "dev anon tasks" ON public.tasks FOR ALL TO anon USING (organization_id = '%s') WITH CHECK (organization_id = '%s')$p$, demo_id, demo_id);
  EXECUTE format($p$CREATE POLICY "dev anon documents" ON public.documents FOR ALL TO anon USING (organization_id = '%s') WITH CHECK (organization_id = '%s')$p$, demo_id, demo_id);
  EXECUTE format($p$CREATE POLICY "dev anon cnj_logs select" ON public.cnj_query_logs FOR SELECT TO anon USING (organization_id = '%s')$p$, demo_id);
  EXECUTE format($p$CREATE POLICY "dev anon cnj_logs insert" ON public.cnj_query_logs FOR INSERT TO anon WITH CHECK (organization_id = '%s')$p$, demo_id);
  EXECUTE format($p$CREATE POLICY "dev anon org view" ON public.organizations FOR SELECT TO anon USING (id = '%s')$p$, demo_id);
  EXECUTE format($p$CREATE POLICY "dev anon org update" ON public.organizations FOR UPDATE TO anon USING (id = '%s') WITH CHECK (id = '%s')$p$, demo_id, demo_id);
END $$;
