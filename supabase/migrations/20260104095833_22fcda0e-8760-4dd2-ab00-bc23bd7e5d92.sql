-- Fix scenes table - add explicit INSERT policy with proper WITH CHECK
DROP POLICY IF EXISTS "Users can manage scenes of their projects" ON public.scenes;

-- Create separate policies for better security granularity
CREATE POLICY "Users can view scenes of their projects"
ON public.scenes
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM projects
  WHERE projects.id = scenes.project_id 
  AND projects.user_id = auth.uid()
));

CREATE POLICY "Users can insert scenes to their projects"
ON public.scenes
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM projects
  WHERE projects.id = scenes.project_id 
  AND projects.user_id = auth.uid()
));

CREATE POLICY "Users can update scenes of their projects"
ON public.scenes
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM projects
  WHERE projects.id = scenes.project_id 
  AND projects.user_id = auth.uid()
));

CREATE POLICY "Users can delete scenes of their projects"
ON public.scenes
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM projects
  WHERE projects.id = scenes.project_id 
  AND projects.user_id = auth.uid()
));

-- Add admin policy for viewing all profiles (for support)
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));