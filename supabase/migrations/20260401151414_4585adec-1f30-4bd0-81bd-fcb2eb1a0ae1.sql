
CREATE TABLE public.demo_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  card_id UUID REFERENCES public.customer_cards(id) ON DELETE SET NULL,
  slug TEXT NOT NULL,
  pass_installed BOOLEAN NOT NULL DEFAULT false,
  demo_started BOOLEAN NOT NULL DEFAULT false,
  current_step INTEGER NOT NULL DEFAULT 0,
  step1_at TIMESTAMP WITH TIME ZONE,
  step2_at TIMESTAMP WITH TIME ZONE,
  step3_at TIMESTAMP WITH TIME ZONE,
  cta_shown_at TIMESTAMP WITH TIME ZONE,
  clicked_signup BOOLEAN NOT NULL DEFAULT false,
  clicked_pricing BOOLEAN NOT NULL DEFAULT false,
  converted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.demo_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view demo sessions"
  ON public.demo_sessions FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create demo sessions"
  ON public.demo_sessions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update demo sessions"
  ON public.demo_sessions FOR UPDATE
  USING (true);

CREATE POLICY "Super admins can delete demo sessions"
  ON public.demo_sessions FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));
