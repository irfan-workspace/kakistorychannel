import { z } from 'zod';

// Auth validation schemas
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email is required')
    .max(255, 'Email must be less than 255 characters')
    .email('Please enter a valid email address'),
  password: z
    .string()
    .min(1, 'Password is required')
    .max(128, 'Password must be less than 128 characters'),
});

export const signupSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email is required')
    .max(255, 'Email must be less than 255 characters')
    .email('Please enter a valid email address'),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters')
    .max(128, 'Password must be less than 128 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    ),
  fullName: z
    .string()
    .trim()
    .max(100, 'Name must be less than 100 characters')
    .optional(),
});

// Project validation schemas
export const createProjectSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Title is required')
    .max(200, 'Title must be less than 200 characters'),
  language: z.enum(['hindi', 'hinglish', 'english']),
  story_type: z.enum(['kids', 'bedtime', 'moral']),
  tone: z.enum(['calm', 'emotional', 'dramatic']),
  visual_style: z.enum(['cartoon', 'storybook', 'kids_illustration']),
  voice_type: z.enum(['male', 'female', 'child']),
  aspect_ratio: z.enum(['16:9', '9:16']),
});

// Script validation
export const scriptSchema = z.object({
  content: z
    .string()
    .trim()
    .min(10, 'Script must be at least 10 characters')
    .max(10000, 'Script must be less than 10,000 characters'),
});

// Scene validation
export const sceneUpdateSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Title is required')
    .max(200, 'Title must be less than 200 characters')
    .optional(),
  narration_text: z
    .string()
    .trim()
    .min(1, 'Narration text is required')
    .max(5000, 'Narration must be less than 5,000 characters')
    .optional(),
  visual_description: z
    .string()
    .trim()
    .max(2000, 'Visual description must be less than 2,000 characters')
    .optional(),
});

// Type exports
export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type ScriptInput = z.infer<typeof scriptSchema>;
export type SceneUpdateInput = z.infer<typeof sceneUpdateSchema>;

// Validation helper function
export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; errors: string[] } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    errors: result.error.errors.map((e) => e.message),
  };
}

// Sanitize text to prevent XSS
export function sanitizeText(text: string): string {
  return text
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
