
-- =========== Profiles ===========
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#F97316',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_read_all_auth" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert_self" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  palette TEXT[] := ARRAY['#F97316','#0EA5E9','#10B981','#EF4444','#8B5CF6','#F59E0B'];
  c TEXT;
BEGIN
  c := palette[1 + (floor(random()*array_length(palette,1)))::int];
  INSERT INTO public.profiles (id, full_name, color)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    c
  );
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========== Updated_at helper ===========
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- =========== Patients ===========
CREATE TABLE public.patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  frequency_per_week SMALLINT NOT NULL DEFAULT 1 CHECK (frequency_per_week BETWEEN 1 AND 3),
  notes TEXT,
  current_block SMALLINT NOT NULL DEFAULT 1 CHECK (current_block BETWEEN 1 AND 4),
  level TEXT NOT NULL DEFAULT 'iniciacion',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patients TO authenticated;
GRANT ALL ON public.patients TO service_role;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "patients_all_auth" ON public.patients FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER patients_updated BEFORE UPDATE ON public.patients FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========== Session Slots (recurring weekly) ===========
CREATE TABLE public.session_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Mon..6=Sun
  start_time TIME NOT NULL,
  duration_min SMALLINT NOT NULL DEFAULT 50,
  capacity SMALLINT NOT NULL DEFAULT 4,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_slots TO authenticated;
GRANT ALL ON public.session_slots TO service_role;
ALTER TABLE public.session_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "slots_all_auth" ON public.session_slots FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER slots_updated BEFORE UPDATE ON public.session_slots FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========== Sessions (concrete instances) ===========
CREATE TABLE public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id UUID REFERENCES public.session_slots(id) ON DELETE SET NULL,
  session_date DATE NOT NULL,
  start_time TIME NOT NULL,
  duration_min SMALLINT NOT NULL DEFAULT 50,
  capacity SMALLINT NOT NULL DEFAULT 4,
  focus_block SMALLINT CHECK (focus_block BETWEEN 1 AND 4),
  warmup TEXT,
  main_block TEXT,
  cooldown TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);
CREATE INDEX sessions_by_date ON public.sessions(session_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sessions TO authenticated;
GRANT ALL ON public.sessions TO service_role;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sessions_all_auth" ON public.sessions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER sessions_updated BEFORE UPDATE ON public.sessions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========== Session attendees ===========
CREATE TABLE public.session_attendees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'programada' CHECK (status IN ('programada','asistio','falta','cancelada')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  UNIQUE (session_id, patient_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_attendees TO authenticated;
GRANT ALL ON public.session_attendees TO service_role;
ALTER TABLE public.session_attendees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attendees_all_auth" ON public.session_attendees FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER attendees_updated BEFORE UPDATE ON public.session_attendees FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========== Quarterly objectives ===========
CREATE TABLE public.quarterly_objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year SMALLINT NOT NULL,
  quarter SMALLINT NOT NULL CHECK (quarter BETWEEN 1 AND 4),
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quarterly_objectives TO authenticated;
GRANT ALL ON public.quarterly_objectives TO service_role;
ALTER TABLE public.quarterly_objectives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "objectives_all_auth" ON public.quarterly_objectives FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER objectives_updated BEFORE UPDATE ON public.quarterly_objectives FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========== Audit log ===========
CREATE TABLE public.audit_log (
  id BIGSERIAL PRIMARY KEY,
  actor_id UUID,
  actor_name TEXT,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  action TEXT NOT NULL CHECK (action IN ('insert','update','delete')),
  changes JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_recent ON public.audit_log(created_at DESC);
CREATE INDEX audit_log_entity ON public.audit_log(entity_type, entity_id);
GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_read_auth" ON public.audit_log FOR SELECT TO authenticated USING (true);

-- Audit trigger
CREATE OR REPLACE FUNCTION public.write_audit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid UUID := auth.uid();
  uname TEXT;
  eid TEXT;
  diff JSONB;
BEGIN
  SELECT full_name INTO uname FROM public.profiles WHERE id = uid;
  IF TG_OP = 'DELETE' THEN
    eid := OLD.id::text;
    diff := to_jsonb(OLD);
  ELSIF TG_OP = 'INSERT' THEN
    eid := NEW.id::text;
    diff := to_jsonb(NEW);
  ELSE
    eid := NEW.id::text;
    diff := jsonb_build_object('before', to_jsonb(OLD), 'after', to_jsonb(NEW));
  END IF;
  INSERT INTO public.audit_log (actor_id, actor_name, entity_type, entity_id, action, changes)
  VALUES (uid, uname, TG_TABLE_NAME, eid, lower(TG_OP), diff);
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER audit_patients AFTER INSERT OR UPDATE OR DELETE ON public.patients FOR EACH ROW EXECUTE FUNCTION public.write_audit();
CREATE TRIGGER audit_slots AFTER INSERT OR UPDATE OR DELETE ON public.session_slots FOR EACH ROW EXECUTE FUNCTION public.write_audit();
CREATE TRIGGER audit_sessions AFTER INSERT OR UPDATE OR DELETE ON public.sessions FOR EACH ROW EXECUTE FUNCTION public.write_audit();
CREATE TRIGGER audit_attendees AFTER INSERT OR UPDATE OR DELETE ON public.session_attendees FOR EACH ROW EXECUTE FUNCTION public.write_audit();
CREATE TRIGGER audit_objectives AFTER INSERT OR UPDATE OR DELETE ON public.quarterly_objectives FOR EACH ROW EXECUTE FUNCTION public.write_audit();
