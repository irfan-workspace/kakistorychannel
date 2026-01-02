import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useProject } from '@/hooks/useProjects';
import { useScenes } from '@/hooks/useScenes';
import { ScriptInput } from '@/components/project/ScriptInput';
import { SceneEditor } from '@/components/project/SceneEditor';
import { VideoTimeline } from '@/components/project/VideoTimeline';
import { ExportPanel } from '@/components/project/ExportPanel';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, FileText, Layers, Film, Download, Settings } from 'lucide-react';
import { ProjectSettings } from '@/components/project/ProjectSettings';

export default function ProjectEditor() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { data: project, isLoading: projectLoading } = useProject(projectId);
  const { scenes, isLoading: scenesLoading } = useScenes(projectId);
  const [activeTab, setActiveTab] = useState('script');

  useEffect(() => {
    if (scenes.length > 0 && activeTab === 'script') {
      // If there are scenes, show the scenes tab
    }
  }, [scenes.length]);

  if (projectLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <Skeleton className="h-[400px] w-full" />
        </div>
      </DashboardLayout>
    );
  }

  if (!project) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold mb-2">Project not found</h2>
          <p className="text-muted-foreground mb-4">
            This project may have been deleted or you don't have access.
          </p>
          <Button onClick={() => navigate('/dashboard')}>Go to Dashboard</Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-display font-bold">{project.title}</h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="capitalize text-xs">
                  {project.language}
                </Badge>
                <Badge variant="outline" className="capitalize text-xs">
                  {project.story_type}
                </Badge>
                <Badge variant="secondary" className="capitalize text-xs">
                  {project.status}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {scenes.length} scene{scenes.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
            <TabsTrigger value="script" className="gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Script</span>
            </TabsTrigger>
            <TabsTrigger value="scenes" className="gap-2">
              <Layers className="h-4 w-4" />
              <span className="hidden sm:inline">Scenes</span>
            </TabsTrigger>
            <TabsTrigger value="timeline" className="gap-2">
              <Film className="h-4 w-4" />
              <span className="hidden sm:inline">Timeline</span>
            </TabsTrigger>
            <TabsTrigger value="export" className="gap-2">
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="script" className="mt-6">
            <ScriptInput
              project={project}
              onScenesGenerated={() => setActiveTab('scenes')}
            />
          </TabsContent>

          <TabsContent value="scenes" className="mt-6">
            <SceneEditor
              project={project}
              scenes={scenes}
              isLoading={scenesLoading}
            />
          </TabsContent>

          <TabsContent value="timeline" className="mt-6">
            <VideoTimeline project={project} scenes={scenes} />
          </TabsContent>

          <TabsContent value="export" className="mt-6">
            <ExportPanel project={project} scenes={scenes} />
          </TabsContent>

          <TabsContent value="settings" className="mt-6">
            <ProjectSettings project={project} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
