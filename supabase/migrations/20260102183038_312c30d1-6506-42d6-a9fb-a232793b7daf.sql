-- ============================================
-- KAKISTORYCHANNEL DATABASE SCHEMA
-- ============================================

-- Create custom types
CREATE TYPE public.story_language AS ENUM ('hindi', 'hinglish', 'english');
CREATE TYPE public.story_type AS ENUM ('kids', 'bedtime', 'moral');
CREATE TYPE public.story_tone AS ENUM ('calm', 'emotional', 'dramatic');
CREATE TYPE public.visual_style AS ENUM ('cartoon', 'storybook', 'kids_illustration');
CREATE TYPE public.voice_type AS ENUM ('male', 'female', 'child');
CREATE TYPE public.project_status AS ENUM ('draft', 'processing', 'ready', 'exported');
CREATE TYPE public.scene_status AS ENUM ('pending', 'generating', 'completed', 'failed');
CREATE TYPE public.subscription_tier AS ENUM ('free', 'monthly', 'credits');
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- ============================================
-- USER PROFILES TABLE
-- ============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  subscription_tier subscription_tier NOT NULL DEFAULT 'free',
  credits_balance INTEGER NOT NULL DEFAULT 5,
  monthly_exports_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- USER ROLES TABLE (for admin access)
-- ============================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checking (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- PROJECTS TABLE
-- ============================================
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  script_content TEXT,
  language story_language NOT NULL DEFAULT 'hindi',
  story_type story_type NOT NULL DEFAULT 'kids',
  tone story_tone NOT NULL DEFAULT 'calm',
  visual_style visual_style NOT NULL DEFAULT 'cartoon',
  voice_type voice_type NOT NULL DEFAULT 'female',
  status project_status NOT NULL DEFAULT 'draft',
  aspect_ratio TEXT NOT NULL DEFAULT '16:9',
  thumbnail_url TEXT,
  exported_video_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own projects"
  ON public.projects FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own projects"
  ON public.projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects"
  ON public.projects FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects"
  ON public.projects FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all projects"
  ON public.projects FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- SCENES TABLE
-- ============================================
CREATE TABLE public.scenes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  scene_order INTEGER NOT NULL,
  title TEXT NOT NULL,
  narration_text TEXT NOT NULL,
  visual_description TEXT,
  estimated_duration DECIMAL(6,2) DEFAULT 5.0,
  actual_duration DECIMAL(6,2),
  mood TEXT,
  image_url TEXT,
  image_status scene_status NOT NULL DEFAULT 'pending',
  audio_url TEXT,
  audio_status scene_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.scenes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage scenes of their projects"
  ON public.scenes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = scenes.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all scenes"
  ON public.scenes FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- SUBSCRIPTIONS TABLE
-- ============================================
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tier subscription_tier NOT NULL DEFAULT 'free',
  razorpay_subscription_id TEXT,
  razorpay_customer_id TEXT,
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own subscriptions"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all subscriptions"
  ON public.subscriptions FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- USAGE LOGS TABLE (for analytics)
-- ============================================
CREATE TABLE public.usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  credits_used INTEGER DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own usage"
  ON public.usage_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own usage"
  ON public.usage_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all usage"
  ON public.usage_logs FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- TRIGGER FOR AUTOMATIC PROFILE CREATION
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- TRIGGER FOR UPDATING updated_at
-- ============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_scenes_updated_at
  BEFORE UPDATE ON public.scenes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- STORAGE BUCKETS
-- ============================================
INSERT INTO storage.buckets (id, name, public) VALUES ('project-assets', 'project-assets', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('exported-videos', 'exported-videos', true);

-- Storage policies
CREATE POLICY "Users can upload to project-assets"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'project-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view project-assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'project-assets');

CREATE POLICY "Users can update their own assets"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'project-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own assets"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'project-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload to exported-videos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'exported-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view exported-videos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'exported-videos');

CREATE POLICY "Users can delete their own videos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'exported-videos' AND auth.uid()::text = (storage.foldername(name))[1]);