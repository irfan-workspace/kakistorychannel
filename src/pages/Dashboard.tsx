import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useProjects } from '@/hooks/useProjects';
import { UsageAnalytics } from '@/components/dashboard/UsageAnalytics';
import { CreditUsageBar } from '@/components/dashboard/CreditUsageBar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, MoreVertical, Video, Clock, Trash2, Edit, Film, Sparkles } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Project, ProjectStatus } from '@/lib/types';
import { useState } from 'react';

const statusConfig: Record<ProjectStatus, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  draft: { label: 'Draft', variant: 'secondary' },
  processing: { label: 'Processing', variant: 'default' },
  ready: { label: 'Ready', variant: 'outline' },
  exported: { label: 'Exported', variant: 'default' },
};

function ProjectCard({ project, onDelete }: { project: Project; onDelete: (id: string) => void }) {
  const navigate = useNavigate();
  const status = statusConfig[project.status];

  return (
    <Card className="group hover:shadow-medium transition-all duration-200 hover:border-primary/30">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1 min-w-0">
            <CardTitle className="text-lg truncate">{project.title}</CardTitle>
            <CardDescription className="flex items-center gap-2 text-xs">
              <Clock className="h-3 w-3" />
              Updated {formatDistanceToNow(new Date(project.updated_at), { addSuffix: true })}
            </CardDescription>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate(`/project/${project.id}`)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete(project.id)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="outline" className="capitalize">
            {project.language}
          </Badge>
          <Badge variant="outline" className="capitalize">
            {project.story_type}
          </Badge>
          <Badge variant="outline" className="capitalize">
            {project.tone}
          </Badge>
        </div>
      </CardContent>
      <CardFooter className="pt-3 border-t flex items-center justify-between">
        <Badge variant={status.variant}>{status.label}</Badge>
        <Button
          size="sm"
          onClick={() => navigate(`/project/${project.id}`)}
          className="gap-1"
        >
          <Film className="h-3 w-3" />
          Open
        </Button>
      </CardFooter>
    </Card>
  );
}

function EmptyState() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="h-20 w-20 rounded-2xl gradient-primary flex items-center justify-center mb-6">
        <Video className="h-10 w-10 text-white" />
      </div>
      <h2 className="text-2xl font-display font-bold mb-2">No projects yet</h2>
      <p className="text-muted-foreground mb-6 max-w-md">
        Create your first story video project and start transforming scripts into
        stunning YouTube-ready content.
      </p>
      <Button
        size="lg"
        className="gradient-primary gap-2"
        onClick={() => navigate('/dashboard/new')}
      >
        <Plus className="h-5 w-5" />
        Create Your First Project
      </Button>
    </div>
  );
}

function ProjectsGrid({ projects, onDelete }: { projects: Project[]; onDelete: (id: string) => void }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} onDelete={onDelete} />
      ))}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i}>
          <CardHeader className="pb-3">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </CardHeader>
          <CardContent className="pb-3">
            <div className="flex gap-2">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-16" />
            </div>
          </CardContent>
          <CardFooter className="pt-3 border-t">
            <Skeleton className="h-5 w-16" />
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { projects, isLoading, deleteProject } = useProjects();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleDelete = () => {
    if (deleteId) {
      deleteProject.mutate(deleteId);
      setDeleteId(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold">Your Projects</h1>
            <p className="text-muted-foreground">
              Create and manage your story video projects
            </p>
          </div>
          <Button
            size="lg"
            className="gradient-primary gap-2"
            onClick={() => navigate('/dashboard/new')}
          >
            <Sparkles className="h-5 w-5" />
            New Project
          </Button>
        </div>

        {/* Credit Usage Bar */}
        <CreditUsageBar />

        {/* Usage Analytics */}
        <UsageAnalytics />

        {/* Content */}
        {isLoading ? (
          <LoadingSkeleton />
        ) : projects.length === 0 ? (
          <EmptyState />
        ) : (
          <ProjectsGrid projects={projects} onDelete={setDeleteId} />
        )}
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this project and all its scenes. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
