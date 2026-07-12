-- =====================================================================
-- MIGRACIÓN INCREMENTAL v2 - Pilates
-- Si YA ejecutaste el schema.sql anterior, ejecuta SOLO este bloque.
-- Si es una base de datos NUEVA, ejecuta primero schema.sql y luego esto.
-- =====================================================================

-- 1) Bloques de entrenamiento editables por la usuaria
CREATE TABLE IF NOT EXISTS public.training_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sort_order SMALLINT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  focus TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_blocks TO authenticated;
GRANT ALL ON public.training_blocks TO service_role;
ALTER TABLE public.training_blocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "blocks_all_auth" ON public.training_blocks;
CREATE POLICY "blocks_all_auth" ON public.training_blocks FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS blocks_updated ON public.training_blocks;
CREATE TRIGGER blocks_updated BEFORE UPDATE ON public.training_blocks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) Seed inicial con los 4 bloques por defecto (solo si la tabla está vacía)
INSERT INTO public.training_blocks (sort_order, title, focus, description)
SELECT * FROM (VALUES
  (1, 'Fundamentos y alineación', 'Meses 1–3', 'Powerhouse, respiración costal, estabilización.'),
  (2, 'Fuerza central y resistencia', 'Meses 4–6', 'Resistencia muscular, disociación, dinámica.'),
  (3, 'Coordinación, equilibrio y variabilidad', 'Meses 7–9', 'Trabajo unilateral, propiocepción.'),
  (4, 'Integración avanzada y potencia', 'Meses 10–12', 'Fluidez, transiciones, control avanzado.')
) AS v(sort_order, title, focus, description)
WHERE NOT EXISTS (SELECT 1 FROM public.training_blocks);

-- 3) Fecha fin opcional para slots recurrentes ("se repite hasta X")
ALTER TABLE public.session_slots ADD COLUMN IF NOT EXISTS end_date DATE;

-- 4) Relajar el CHECK de sessions.focus_block y patients.current_block para
--    permitir más de 4 bloques.
ALTER TABLE public.sessions DROP CONSTRAINT IF EXISTS sessions_focus_block_check;
ALTER TABLE public.patients DROP CONSTRAINT IF EXISTS patients_current_block_check;
ALTER TABLE public.quarterly_objectives DROP CONSTRAINT IF EXISTS quarterly_objectives_quarter_check;
