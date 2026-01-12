-- Add notification preferences to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS notification_preferences jsonb DEFAULT '{"email_updates": true, "project_notifications": true, "marketing_emails": false}'::jsonb;