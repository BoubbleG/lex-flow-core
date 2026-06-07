
-- ============ ENUMS ============
CREATE TYPE public.case_status AS ENUM ('ativo', 'arquivado', 'suspenso', 'encerrado');
CREATE TYPE public.task_priority AS ENUM ('baixa', 'media', 'alta');
CREATE TYPE public.task_status AS ENUM ('pendente', 'em_andamento', 'concluida', 'atrasada');
CREATE TYPE public.user_role AS ENUM ('owner', 'admin', 'member');

-- ============ ORGANIZATIONS ============
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  document TEXT,
  plan TEXT NOT NULL DEFAULT 'free',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- ============ USERS PROFILE ============
CREATE TABLE public.users_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  oab_number TEXT,
  oab_state TEXT,
  practice_area TEXT,
  role public.user_role NOT NULL DEFAULT 'owner',
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_users_profile_org ON public.users_profile(organization_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users_profile TO authenticated;
GRANT ALL ON public.users_profile TO service_role;
ALTER TABLE public.users_profile ENABLE ROW LEVEL SECURITY;

-- ============ HELPER: get current user's org ============
CREATE OR REPLACE FUNCTION public.get_user_org(_user_id UUID)
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.users_profile WHERE user_id = _user_id LIMIT 1;
$$;

-- ============ RLS: organizations ============
CREATE POLICY "members view their org" ON public.organizations
  FOR SELECT TO authenticated USING (id = public.get_user_org(auth.uid()));
CREATE POLICY "members update their org" ON public.organizations
  FOR UPDATE TO authenticated USING (id = public.get_user_org(auth.uid()));

-- ============ RLS: users_profile ============
CREATE POLICY "view profiles in same org" ON public.users_profile
  FOR SELECT TO authenticated USING (organization_id = public.get_user_org(auth.uid()));
CREATE POLICY "update own profile" ON public.users_profile
  FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "insert own profile" ON public.users_profile
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- ============ CLIENTS ============
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  document TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_clients_org ON public.clients(organization_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clients org isolation" ON public.clients
  FOR ALL TO authenticated
  USING (organization_id = public.get_user_org(auth.uid()))
  WITH CHECK (organization_id = public.get_user_org(auth.uid()));

-- ============ CASES ============
CREATE TABLE public.cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  cnj_number TEXT,
  title TEXT,
  court TEXT,
  judicial_body TEXT,
  case_class TEXT,
  subject TEXT,
  opposing_party TEXT,
  claim_value NUMERIC(15,2),
  distribution_date DATE,
  status public.case_status NOT NULL DEFAULT 'ativo',
  responsible_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  last_cnj_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cases_org ON public.cases(organization_id);
CREATE INDEX idx_cases_client ON public.cases(client_id);
CREATE INDEX idx_cases_cnj ON public.cases(cnj_number);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cases TO authenticated;
GRANT ALL ON public.cases TO service_role;
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cases org isolation" ON public.cases
  FOR ALL TO authenticated
  USING (organization_id = public.get_user_org(auth.uid()))
  WITH CHECK (organization_id = public.get_user_org(auth.uid()));

-- ============ CASE MOVEMENTS ============
CREATE TABLE public.case_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  movement_date TIMESTAMPTZ NOT NULL,
  description TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  external_id TEXT,
  is_new BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_movements_case ON public.case_movements(case_id, movement_date DESC);
CREATE INDEX idx_movements_org ON public.case_movements(organization_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_movements TO authenticated;
GRANT ALL ON public.case_movements TO service_role;
ALTER TABLE public.case_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "movements org isolation" ON public.case_movements
  FOR ALL TO authenticated
  USING (organization_id = public.get_user_org(auth.uid()))
  WITH CHECK (organization_id = public.get_user_org(auth.uid()));

-- ============ TASKS ============
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMPTZ,
  priority public.task_priority NOT NULL DEFAULT 'media',
  status public.task_status NOT NULL DEFAULT 'pendente',
  responsible_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tasks_org ON public.tasks(organization_id);
CREATE INDEX idx_tasks_due ON public.tasks(due_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tasks org isolation" ON public.tasks
  FOR ALL TO authenticated
  USING (organization_id = public.get_user_org(auth.uid()))
  WITH CHECK (organization_id = public.get_user_org(auth.uid()));

-- ============ DOCUMENTS ============
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_documents_org ON public.documents(organization_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "documents org isolation" ON public.documents
  FOR ALL TO authenticated
  USING (organization_id = public.get_user_org(auth.uid()))
  WITH CHECK (organization_id = public.get_user_org(auth.uid()));

-- ============ CNJ QUERY LOGS ============
CREATE TABLE public.cnj_query_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  cnj_number TEXT NOT NULL,
  status TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'datajud',
  response_summary TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cnj_logs_org ON public.cnj_query_logs(organization_id, created_at DESC);
GRANT SELECT, INSERT ON public.cnj_query_logs TO authenticated;
GRANT ALL ON public.cnj_query_logs TO service_role;
ALTER TABLE public.cnj_query_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cnj logs view org" ON public.cnj_query_logs
  FOR SELECT TO authenticated USING (organization_id = public.get_user_org(auth.uid()));
CREATE POLICY "cnj logs insert org" ON public.cnj_query_logs
  FOR INSERT TO authenticated WITH CHECK (organization_id = public.get_user_org(auth.uid()));

-- ============ UPDATED AT TRIGGERS ============
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_users_profile_updated BEFORE UPDATE ON public.users_profile
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_clients_updated BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_cases_updated BEFORE UPDATE ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_tasks_updated BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ AUTO-CREATE ORG + PROFILE ON SIGNUP ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id UUID;
  display_name TEXT;
BEGIN
  display_name := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));

  INSERT INTO public.organizations (name, plan)
  VALUES (COALESCE(NEW.raw_user_meta_data->>'org_name', display_name || ' - Escritório'), 'free')
  RETURNING id INTO new_org_id;

  INSERT INTO public.users_profile (user_id, organization_id, name, email, role, onboarding_completed)
  VALUES (NEW.id, new_org_id, display_name, NEW.email, 'owner', false);

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
