-- Index for efficient cron queries on scheduled campaigns
CREATE INDEX IF NOT EXISTS idx_notification_campaigns_pending
  ON public.notification_campaigns(status, send_at)
  WHERE status = 'scheduled';
