// Database enum types
export type StoryLanguage = 'hindi' | 'hinglish' | 'english';
export type StoryType = 'kids' | 'bedtime' | 'moral';
export type StoryTone = 'calm' | 'emotional' | 'dramatic';
export type VisualStyle = 'cartoon' | 'storybook' | 'kids_illustration';
export type VoiceType = 'male' | 'female' | 'child';
export type ProjectStatus = 'draft' | 'processing' | 'ready' | 'exported';
export type SceneStatus = 'pending' | 'generating' | 'completed' | 'failed';
export type SubscriptionTier = 'free' | 'credits';
export type AppRole = 'admin' | 'user';

// Profile type
export interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  subscription_tier: SubscriptionTier;
  credits_balance: number;
  monthly_exports_used: number;
  created_at: string;
  updated_at: string;
}

// Project type
export interface Project {
  id: string;
  user_id: string;
  title: string;
  script_content: string | null;
  language: StoryLanguage;
  story_type: StoryType;
  tone: StoryTone;
  visual_style: VisualStyle;
  voice_type: VoiceType;
  status: ProjectStatus;
  aspect_ratio: string;
  thumbnail_url: string | null;
  exported_video_url: string | null;
  created_at: string;
  updated_at: string;
}

// Scene type
export interface Scene {
  id: string;
  project_id: string;
  scene_order: number;
  title: string;
  narration_text: string;
  visual_description: string | null;
  estimated_duration: number | null;
  actual_duration: number | null;
  mood: string | null;
  image_url: string | null;
  image_status: SceneStatus;
  audio_url: string | null;
  audio_status: SceneStatus;
  created_at: string;
  updated_at: string;
}

// Subscription type
export interface Subscription {
  id: string;
  user_id: string;
  tier: SubscriptionTier;
  razorpay_subscription_id: string | null;
  razorpay_customer_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Usage log type
export interface UsageLog {
  id: string;
  user_id: string;
  project_id: string | null;
  action_type: string;
  credits_used: number;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// User role type
export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

// Form types for creating/updating
export interface CreateProjectInput {
  title: string;
  language: StoryLanguage;
  story_type: StoryType;
  tone: StoryTone;
  visual_style: VisualStyle;
  voice_type: VoiceType;
  aspect_ratio: string;
}

export interface UpdateProjectInput extends Partial<CreateProjectInput> {
  script_content?: string;
  status?: ProjectStatus;
  thumbnail_url?: string;
  exported_video_url?: string;
}

export interface CreateSceneInput {
  project_id: string;
  scene_order: number;
  title: string;
  narration_text: string;
  visual_description?: string;
  estimated_duration?: number;
  mood?: string;
}

export interface UpdateSceneInput extends Partial<Omit<CreateSceneInput, 'project_id'>> {
  image_url?: string;
  image_status?: SceneStatus;
  audio_url?: string;
  audio_status?: SceneStatus;
  actual_duration?: number;
}

// AI Generation types
export interface GeneratedScene {
  title: string;
  narration_text: string;
  visual_description: string;
  estimated_duration: number;
  mood: string;
}

export interface SceneGenerationResult {
  scenes: GeneratedScene[];
}

// Export options
export interface ExportOptions {
  aspectRatio: '16:9' | '9:16';
  resolution: '1080p';
  includeWatermark: boolean;
}
