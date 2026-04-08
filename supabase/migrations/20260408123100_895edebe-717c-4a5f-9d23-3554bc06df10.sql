
-- Create enum for reward instance status
CREATE TYPE public.reward_instance_status AS ENUM (
  'unlocked_pending_next_order',
  'claimable_now',
  'claimed'
);

-- Create reward_instances table
CREATE TABLE public.reward_instances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES public.customer_cards(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  reward_id UUID NOT NULL REFERENCES public.rewards(id) ON DELETE CASCADE,
  status reward_instance_status NOT NULL DEFAULT 'unlocked_pending_next_order',
  points_at_unlock INTEGER NOT NULL DEFAULT 0,
  unlocked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  claimed_at TIMESTAMP WITH TIME ZONE,
  claim_scan_id UUID REFERENCES public.points_history(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Prevent duplicate reward instances for the same reward on the same card that aren't claimed
CREATE UNIQUE INDEX idx_reward_instances_active ON public.reward_instances (card_id, reward_id) 
  WHERE status != 'claimed';

-- Performance indexes
CREATE INDEX idx_reward_instances_card ON public.reward_instances (card_id);
CREATE INDEX idx_reward_instances_customer ON public.reward_instances (customer_id);
CREATE INDEX idx_reward_instances_business ON public.reward_instances (business_id);
CREATE INDEX idx_reward_instances_status ON public.reward_instances (status);

-- Enable RLS
ALTER TABLE public.reward_instances ENABLE ROW LEVEL SECURITY;

-- Business owners can manage their reward instances
CREATE POLICY "Business owners can manage reward instances"
  ON public.reward_instances
  FOR ALL
  USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()))
  WITH CHECK (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

-- Super admins can delete
CREATE POLICY "Super admins can delete reward instances"
  ON public.reward_instances
  FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'));

-- Super admins can view all
CREATE POLICY "Super admins can view reward instances"
  ON public.reward_instances
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'));

-- Trigger for updated_at
CREATE TRIGGER update_reward_instances_updated_at
  BEFORE UPDATE ON public.reward_instances
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Enable realtime for reward_instances
ALTER PUBLICATION supabase_realtime ADD TABLE public.reward_instances;
