import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { SignupForm } from '@/components/auth/SignupForm';
import { BookOpen } from 'lucide-react';

export default function Signup() {
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
            Start Creating<br />Amazing Story Videos
          </h1>
          <p className="text-white/80 text-lg max-w-md">
            Join thousands of creators who use AI to turn their stories 
            into engaging YouTube videos - no editing skills required.
          </p>
          <ul className="space-y-3 text-white/80">
            <li className="flex items-center gap-3">
              <div className="h-6 w-6 rounded-full bg-white/20 flex items-center justify-center text-xs">✓</div>
              AI-powered scene generation
            </li>
            <li className="flex items-center gap-3">
              <div className="h-6 w-6 rounded-full bg-white/20 flex items-center justify-center text-xs">✓</div>
              Professional voiceovers in multiple languages
            </li>
            <li className="flex items-center gap-3">
              <div className="h-6 w-6 rounded-full bg-white/20 flex items-center justify-center text-xs">✓</div>
              Export ready for YouTube & Shorts
            </li>
          </ul>
        </div>

        <p className="text-white/60 text-sm">
          © 2024 KakiStoryChannel. All rights reserved.
        </p>
      </div>

      {/* Right side - signup form */}
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
          <SignupForm />
        </div>
      </div>
    </div>
  );
}
