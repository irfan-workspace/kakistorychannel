import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Scene, CreateSceneInput, UpdateSceneInput } from '@/lib/types';
import { toast } from 'sonner';

export function useScenes(projectId: string | undefined) {
  const queryClient = useQueryClient();

  const scenesQuery = useQuery({
    queryKey: ['scenes', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      
      const { data, error } = await supabase
        .from('scenes')
        .select('*')
        .eq('project_id', projectId)
        .order('scene_order', { ascending: true });

      if (error) throw error;
      return data as Scene[];
    },
    enabled: !!projectId,
  });

  const createScene = useMutation({
    mutationFn: async (input: CreateSceneInput) => {
      const { data, error } = await supabase
        .from('scenes')
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      return data as Scene;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scenes', projectId] });
    },
    onError: (error) => {
      toast.error('Failed to create scene: ' + error.message);
    },
  });

  const createScenes = useMutation({
    mutationFn: async (inputs: CreateSceneInput[]) => {
      const { data, error } = await supabase
        .from('scenes')
        .insert(inputs)
        .select();

      if (error) throw error;
      return data as Scene[];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scenes', projectId] });
      toast.success('Scenes generated successfully');
    },
    onError: (error) => {
      toast.error('Failed to create scenes: ' + error.message);
    },
  });

  const updateScene = useMutation({
    mutationFn: async ({ id, ...input }: UpdateSceneInput & { id: string }) => {
      const { data, error } = await supabase
        .from('scenes')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Scene;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scenes', projectId] });
    },
    onError: (error) => {
      toast.error('Failed to update scene: ' + error.message);
    },
  });

  const deleteScene = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('scenes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scenes', projectId] });
      toast.success('Scene deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete scene: ' + error.message);
    },
  });

  const reorderScenes = useMutation({
    mutationFn: async (scenes: { id: string; scene_order: number }[]) => {
      const updates = scenes.map(({ id, scene_order }) =>
        supabase.from('scenes').update({ scene_order }).eq('id', id)
      );
      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scenes', projectId] });
    },
    onError: (error) => {
      toast.error('Failed to reorder scenes: ' + error.message);
    },
  });

  const deleteAllScenes = useMutation({
    mutationFn: async () => {
      if (!projectId) throw new Error('No project ID');
      const { error } = await supabase
        .from('scenes')
        .delete()
        .eq('project_id', projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scenes', projectId] });
    },
  });

  return {
    scenes: scenesQuery.data ?? [],
    isLoading: scenesQuery.isLoading,
    error: scenesQuery.error,
    createScene,
    createScenes,
    updateScene,
    deleteScene,
    reorderScenes,
    deleteAllScenes,
    refetch: scenesQuery.refetch,
  };
}
