-- Enable realtime for api_usage_logs table
ALTER TABLE public.api_usage_logs REPLICA IDENTITY FULL;

-- Add table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.api_usage_logs;