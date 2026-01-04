import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  BookOpen,
  Play,
  Sparkles,
  Layers,
  Mic,
  Film,
  ArrowRight,
  Check,
  Star,
} from 'lucide-react';

export default function Index() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const features = [
    {
      icon: Layers,
      title: 'AI Scene Generation',
      description: 'Automatically split your script into visual scenes with smart AI analysis',
    },
    {
      icon: Sparkles,
      title: 'Stunning Visuals',
      description: 'Generate beautiful illustrations for each scene in your chosen style',
    },
    {
      icon: Mic,
      title: 'Professional Voiceover',
      description: 'Add lifelike voices in Hindi, Hinglish, or English with ElevenLabs AI',
    },
    {
      icon: Film,
      title: 'One-Click Export',
      description: 'Export YouTube-ready videos in 16:9 or Shorts format instantly',
    },
  ];

  const steps = [
    'Paste your story script',
    'AI generates visual scenes',
    'Customize images & voiceovers',
    'Export YouTube-ready video',
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-white" />
            </div>
            <span className="font-display font-bold text-lg">KakiStoryChannel</span>
          </Link>
          <div className="flex items-center gap-3">
            {user ? (
              <Button onClick={() => navigate('/dashboard')} className="gradient-primary gap-2">
                Go to Dashboard
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <>
                <Button variant="ghost" asChild>
                  <Link to="/login">Sign In</Link>
                </Button>
                <Button asChild className="gradient-primary">
                  <Link to="/signup">Get Started</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 gradient-sunset" />
        <div className="container relative py-24 md:py-32">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <Badge className="gradient-primary text-sm px-4 py-1">
              <Star className="h-3 w-3 mr-1" />
              AI-Powered Story Videos
            </Badge>
            <h1 className="text-4xl md:text-6xl font-display font-bold leading-tight">
              Transform Your Stories Into{' '}
              <span className="text-gradient">Stunning Videos</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Create YouTube-ready story videos in minutes. Paste your script, let AI
              handle visuals and voiceover, export professional videos — no editing skills
              required.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button
                size="lg"
                onClick={() => navigate(user ? '/dashboard' : '/signup')}
                className="gradient-primary gap-2 text-lg px-8"
              >
                <Play className="h-5 w-5" />
                Start Creating Free
              </Button>
              <Button size="lg" variant="outline" className="gap-2 text-lg px-8">
                Watch Demo
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              No credit card required • 5 free credits to start
            </p>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-muted/30">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-display font-bold mb-3">
              Story to Video in 4 Simple Steps
            </h2>
            <p className="text-muted-foreground">
              From script to YouTube-ready video in under 10 minutes
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-4xl mx-auto">
            {steps.map((step, index) => (
              <div
                key={index}
                className="relative p-6 rounded-xl bg-card border shadow-soft text-center"
              >
                <div className="h-10 w-10 rounded-full gradient-primary flex items-center justify-center mx-auto mb-4 text-white font-bold">
                  {index + 1}
                </div>
                <p className="font-medium">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-display font-bold mb-3">
              Everything You Need
            </h2>
            <p className="text-muted-foreground">
              Powerful AI tools designed for story creators
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div
                  key={index}
                  className="p-6 rounded-xl bg-card border hover:shadow-medium transition-shadow"
                >
                  <div className="h-12 w-12 rounded-lg gradient-primary flex items-center justify-center mb-4">
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pricing Preview */}
      <section className="py-20 bg-muted/30">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-display font-bold mb-3">
              Simple, Transparent Pricing
            </h2>
            <p className="text-muted-foreground">Start free, upgrade when you need more</p>
          </div>
          <div className="max-w-sm mx-auto">
            <div className="p-8 rounded-2xl bg-card border shadow-medium text-center">
              <h3 className="text-xl font-bold mb-2">Free to Start</h3>
              <p className="text-4xl font-bold mb-4">
                ₹0<span className="text-lg text-muted-foreground">/month</span>
              </p>
              <ul className="space-y-3 mb-6 text-left">
                {['5 free credits', '3 projects', 'All AI features', 'Basic support'].map(
                  (item) => (
                    <li key={item} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-success" />
                      {item}
                    </li>
                  )
                )}
              </ul>
              <Button
                className="w-full gradient-primary"
                onClick={() => navigate(user ? '/dashboard' : '/signup')}
              >
                Get Started Free
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center p-12 rounded-2xl gradient-primary text-white">
            <h2 className="text-3xl font-display font-bold mb-4">
              Ready to Create Your First Story Video?
            </h2>
            <p className="text-white/80 mb-6">
              Join thousands of creators making engaging YouTube content with AI
            </p>
            <Button
              size="lg"
              variant="secondary"
              onClick={() => navigate(user ? '/dashboard' : '/signup')}
              className="gap-2"
            >
              Start Creating Now
              <ArrowRight className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded gradient-primary flex items-center justify-center">
              <BookOpen className="h-4 w-4 text-white" />
            </div>
            <span className="font-display font-semibold">KakiStoryChannel</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} KakiStoryChannel. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
