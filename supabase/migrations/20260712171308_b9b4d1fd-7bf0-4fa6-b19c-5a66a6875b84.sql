-- Allow authenticated users to log their own auth events (login/logout) into audit_log
CREATE POLICY "audit_insert_own_auth_events" ON public.audit_log
  FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid() AND entity_type = 'auth');