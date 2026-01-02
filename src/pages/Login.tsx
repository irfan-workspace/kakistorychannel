import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { LoginForm } from '@/components/auth/LoginForm';
import { BookOpen } from 'lucide-react';

export default function Login() {
  const { user, isLoading } = useAuth();

  if (!isLoading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen flex gradient-sunset">
      {/* Left side - branding */}
      <div className="hidden lg:flex lg:w-1/2 gradient-primary p-12 flex-col justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
            <BookOpen className="h-6 w-6 text-white" />
          </div>
          <span className="text-xl font-display font-bold text-white">
            KakiStoryChannel
          </span>
        </div>

        <div className="space-y-6">
          <h1 className="text-4xl font-display font-bold text-white leading-tight">
            Transform Your Stories<br />Into Stunning Videos
          </h1>
          <p className="text-white/80 text-lg max-w-md">
            Paste your script, let AI handle the visuals and voiceover, 
            and export YouTube-ready videos in minutes.
          </p>
          <div className="flex gap-4 text-white/70 text-sm">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-white/60" />
              Kids Stories
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-white/60" />
              Bedtime Tales
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-white/60" />
              Moral Stories
            </div>
          </div>
        </div>

        <p className="text-white/60 text-sm">
          © 2024 KakiStoryChannel. All rights reserved.
        </p>
      </div>

      {/* Right side - login form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <div className="h-10 w-10 rounded-xl gradient-primary flex items-center justify-center">
              <BookOpen className="h-6 w-6 text-white" />
            </div>
            <span className="text-xl font-display font-bold text-foreground">
              KakiStoryChannel
            </span>
          </div>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
