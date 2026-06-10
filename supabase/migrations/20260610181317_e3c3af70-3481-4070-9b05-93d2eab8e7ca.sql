-- 1) case_parties
CREATE TABLE public.case_parties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  role text NOT NULL, -- 'ativo' | 'passivo' | 'outro'
  name text NOT NULL,
  document text,
  person_type text, -- 'fisica' | 'juridica'
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_case_parties_case ON public.case_parties(case_id);
CREATE INDEX idx_case_parties_org ON public.case_parties(organization_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_parties TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_parties TO anon;
GRANT ALL ON public.case_parties TO service_role;
ALTER TABLE public.case_parties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "parties org isolation" ON public.case_parties
  TO authenticated USING (organization_id = get_user_org(auth.uid()))
  WITH CHECK (organization_id = get_user_org(auth.uid()));
CREATE POLICY "dev anon case_parties" ON public.case_parties
  TO anon USING (organization_id = '00000000-0000-0000-0000-0000000000a1'::uuid)
  WITH CHECK (organization_id = '00000000-0000-0000-0000-0000000000a1'::uuid);

-- 2) case_lawyers
CREATE TABLE public.case_lawyers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  party_id uuid REFERENCES public.case_parties(id) ON DELETE SET NULL,
  name text NOT NULL,
  oab text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_case_lawyers_case ON public.case_lawyers(case_id);
CREATE INDEX idx_case_lawyers_org ON public.case_lawyers(organization_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_lawyers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_lawyers TO anon;
GRANT ALL ON public.case_lawyers TO service_role;
ALTER TABLE public.case_lawyers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lawyers org isolation" ON public.case_lawyers
  TO authenticated USING (organization_id = get_user_org(auth.uid()))
  WITH CHECK (organization_id = get_user_org(auth.uid()));
CREATE POLICY "dev anon case_lawyers" ON public.case_lawyers
  TO anon USING (organization_id = '00000000-0000-0000-0000-0000000000a1'::uuid)
  WITH CHECK (organization_id = '00000000-0000-0000-0000-0000000000a1'::uuid);

-- 3) notifications
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid,
  case_id uuid REFERENCES public.cases(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'nova_movimentacao',
  title text NOT NULL,
  body text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_org_unread ON public.notifications(organization_id, read_at, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO anon;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications org isolation" ON public.notifications
  TO authenticated USING (organization_id = get_user_org(auth.uid()))
  WITH CHECK (organization_id = get_user_org(auth.uid()));
CREATE POLICY "dev anon notifications" ON public.notifications
  TO anon USING (organization_id = '00000000-0000-0000-0000-0000000000a1'::uuid)
  WITH CHECK (organization_id = '00000000-0000-0000-0000-0000000000a1'::uuid);

-- 4) cnj_query_logs: duração
ALTER TABLE public.cnj_query_logs ADD COLUMN IF NOT EXISTS duration_ms integer;

-- 5) organizations: toggle de auto-sync
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS auto_sync_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS last_auto_sync_at timestamptz;

-- 6) Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- 7) Extensões e cron
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Cancela job anterior (idempotente)
DO $$
BEGIN
  PERFORM cron.unschedule('cnj-auto-sync');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'cnj-auto-sync',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--163bed13-893e-4a42-86f9-055c430ed1b6.lovable.app/api/public/hooks/cnj-sync',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvanNzY2hwenZxeHlkY2prbGxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4MDA3NTIsImV4cCI6MjA5NjM3Njc1Mn0.jXEwOmyKfXhM1CLfGIrnLX2aPGXeEkZl75lV95Rlz-I"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);