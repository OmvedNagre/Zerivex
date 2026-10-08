'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  GraduationCap,
  Wrench,
  Building2,
  Rocket,
  ShieldCheck,
  ScanSearch,
  BookOpen,
  Globe,
  Workflow,
  BadgeCheck,
  ArrowRight,
  ArrowLeft,
  Check,
  Shield,
} from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import '@/styles/onboarding.css';

interface OnboardingFormState {
  displayName: string;
  workspaceName: string;
  persona: 'STUDENT' | 'SOLO_BUILDER' | 'FREELANCER_AGENCY' | 'STARTUP_FOUNDER' | 'COMPANY_TEAM';
  goals: string[];
  builtWith: string[];
  stack: string[];
  targetUrl: string;
}

const PERSONA_OPTIONS = [
  {
    id: 'STUDENT' as const,
    title: 'Student',
    desc: 'Learning application security and building verified portfolio apps.',
    icon: GraduationCap,
  },
  {
    id: 'SOLO_BUILDER' as const,
    title: 'Solo Builder',
    desc: 'Shipping indie software, SaaS apps, and autonomous AI-assisted tools.',
    icon: Wrench,
  },
  {
    id: 'FREELANCER_AGENCY' as const,
    title: 'Freelancer / Agency',
    desc: 'Securing, auditing, and continuous monitoring for client web properties.',
    icon: Building2,
  },
  {
    id: 'STARTUP_FOUNDER' as const,
    title: 'Startup Founder',
    desc: 'Proving perimeter security to enterprise prospects before launch.',
    icon: Rocket,
  },
  {
    id: 'COMPANY_TEAM' as const,
    title: 'Company Engineering Team',
    desc: 'DevSecOps workflows, cryptographic audit vaults, and multi-member team posture.',
    icon: ShieldCheck,
  },
];

const GOAL_OPTIONS = [
  { id: 'CHECK_APP', label: 'Check my app for vulnerabilities', icon: ScanSearch },
  { id: 'LEARN_SECURITY', label: 'Learn security best practices', icon: BookOpen },
  { id: 'PROTECT_CLIENTS', label: 'Protect & monitor client sites', icon: Globe },
  { id: 'SETUP_CI_GATE', label: 'Set up a CI quality gate', icon: Workflow },
  { id: 'SHOW_COMPLIANCE', label: 'Show customers we are secure', icon: BadgeCheck },
];

const BUILD_TOOL_OPTIONS = [
  { id: 'CURSOR', label: 'Cursor' },
  { id: 'LOVABLE', label: 'Lovable' },
  { id: 'V0', label: 'v0' },
  { id: 'BOLT', label: 'Bolt' },
  { id: 'CLAUDE_CODE', label: 'Claude Code' },
  { id: 'HAND_CODED', label: 'Hand-coded' },
  { id: 'OTHER', label: 'Other' },
];

const STACK_OPTIONS = [
  { id: 'NEXTJS', label: 'Next.js / React' },
  { id: 'EXPRESS', label: 'Node / Express' },
  { id: 'NGINX', label: 'Nginx / Static' },
  { id: 'OTHER', label: 'Other' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<OnboardingFormState>({
    displayName: '',
    workspaceName: '',
    persona: 'SOLO_BUILDER',
    goals: ['CHECK_APP'],
    builtWith: ['CURSOR'],
    stack: ['NEXTJS'],
    targetUrl: '',
  });

  // Prefill user details once mounted
  useEffect(() => {
    if (user?.displayName) {
      setFormData((prev) => ({
        ...prev,
        displayName: prev.displayName || user.displayName || '',
      }));
    }
  }, [user]);

  const handleSkip = async () => {
    try {
      setLoading(true);
      await fetch('/api/me/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onboardingSkipped: true }),
      });
      router.push('/dashboard');
    } catch {
      router.push('/dashboard');
    }
  };

  const handleNext = async () => {
    if (step < 5) {
      setStep((prev) => prev + 1);
      return;
    }

    // Step 5 Submit: complete onboarding
    try {
      setLoading(true);
      await fetch('/api/me/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: formData.displayName,
          persona: formData.persona,
          goals: formData.goals,
          builtWith: formData.builtWith,
          stack: formData.stack,
          onboardingCompleted: true,
        }),
      });

      if (formData.targetUrl.trim()) {
        const encodedUrl = encodeURIComponent(formData.targetUrl.trim());
        router.push(`/dashboard/targets?new=${encodedUrl}`);
      } else {
        router.push('/dashboard');
      }
    } catch (err) {
      console.error('Failed to save profile during onboarding:', err);
      router.push('/dashboard');
    }
  };

  const toggleGoal = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      goals: prev.goals.includes(id)
        ? prev.goals.filter((g) => g !== id)
        : [...prev.goals, id],
    }));
  };

  const toggleTool = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      builtWith: prev.builtWith.includes(id)
        ? prev.builtWith.filter((t) => t !== id)
        : [...prev.builtWith, id],
    }));
  };

  const toggleStack = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      stack: prev.stack.includes(id)
        ? prev.stack.filter((s) => s !== id)
        : [...prev.stack, id],
    }));
  };

  return (
    <div className="zob-wrapper" data-testid="onboarding-wizard">
      <div className="zob-container">
        {/* Header Navigation */}
        <header className="zob-header">
          <Link href="/dashboard" className="zob-logo">
            <span className="zob-logo-mark">Z</span>
            <span>Zerivex</span>
          </Link>

          <button
            type="button"
            className="zob-skip-btn"
            onClick={handleSkip}
            disabled={loading}
            data-testid="onboarding-skip-btn"
          >
            Skip for now
          </button>
        </header>

        {/* Step Progress Dots */}
        <div className="zob-progress" aria-label={`Step ${step} of 5`}>
          {[1, 2, 3, 4, 5].map((s) => (
            <div
              key={s}
              className={`zob-step-dot ${
                s === step ? 'is-active' : s < step ? 'is-completed' : ''
              }`}
            />
          ))}
        </div>

        {/* Card Form */}
        <div className="zob-card">
          {/* STEP 1: Name and Workspace */}
          {step === 1 && (
            <section data-testid="onboarding-step-1">
              <span className="zob-eyebrow">Step 1 of 5 • Welcome</span>
              <h1 className="zob-title">What should we call you?</h1>
              <p className="zob-subtitle">
                Set up your personal display name and primary security workspace.
              </p>

              <div className="zob-input-group">
                <label className="zob-label" htmlFor="displayName">
                  Your Full Name
                </label>
                <input
                  id="displayName"
                  type="text"
                  className="zob-input"
                  placeholder="e.g. Alex Chen"
                  value={formData.displayName}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, displayName: e.target.value }))
                  }
                  autoFocus
                />
              </div>

              <div className="zob-input-group">
                <label className="zob-label" htmlFor="workspaceName">
                  Workspace Name (Optional)
                </label>
                <input
                  id="workspaceName"
                  type="text"
                  className="zob-input"
                  placeholder="e.g. Acme Security / Personal"
                  value={formData.workspaceName}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, workspaceName: e.target.value }))
                  }
                />
              </div>
            </section>
          )}

          {/* STEP 2: Persona Selection */}
          {step === 2 && (
            <section data-testid="onboarding-step-2">
              <span className="zob-eyebrow">Step 2 of 5 • Profile</span>
              <h1 className="zob-title">What best describes you?</h1>
              <p className="zob-subtitle">
                We use this to tailor default recommendations, Academy tracks, and sidebar layout.
              </p>

              <div className="zob-grid-cards">
                {PERSONA_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = formData.persona === opt.id;
                  return (
                    <div
                      key={opt.id}
                      className={`zob-choice-card ${isSelected ? 'is-selected' : ''}`}
                      onClick={() =>
                        setFormData((prev) => ({ ...prev, persona: opt.id }))
                      }
                      role="radio"
                      aria-checked={isSelected}
                      tabIndex={0}
                    >
                      <div className="zob-choice-icon">
                        <Icon size={18} />
                      </div>
                      <div>
                        <div className="zob-choice-title">{opt.title}</div>
                        <div className="zob-choice-desc">{opt.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* STEP 3: Goals */}
          {step === 3 && (
            <section data-testid="onboarding-step-3">
              <span className="zob-eyebrow">Step 3 of 5 • Intent</span>
              <h1 className="zob-title">What do you want to do first?</h1>
              <p className="zob-subtitle">
                Select your immediate security goals. You can adjust these anytime.
              </p>

              <div className="zob-chips-group">
                {GOAL_OPTIONS.map((g) => {
                  const Icon = g.icon;
                  const isSelected = formData.goals.includes(g.id);
                  return (
                    <button
                      key={g.id}
                      type="button"
                      className={`zob-chip-btn ${isSelected ? 'is-selected' : ''}`}
                      onClick={() => toggleGoal(g.id)}
                    >
                      <Icon size={14} />
                      <span>{g.label}</span>
                      {isSelected && <Check size={13} />}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* STEP 4: Stack & Tools */}
          {step === 4 && (
            <section data-testid="onboarding-step-4">
              <span className="zob-eyebrow">Step 4 of 5 • Tech Stack</span>
              <h1 className="zob-title">How did you build it?</h1>
              <p className="zob-subtitle">
                This configures your default framework tab in code fix snippets and guides.
              </p>

              <label className="zob-label" style={{ marginBottom: '0.75rem' }}>
                AI & Development Tools
              </label>
              <div className="zob-chips-group">
                {BUILD_TOOL_OPTIONS.map((t) => {
                  const isSelected = formData.builtWith.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      className={`zob-chip-btn ${isSelected ? 'is-selected' : ''}`}
                      onClick={() => toggleTool(t.id)}
                    >
                      <span>{t.label}</span>
                      {isSelected && <Check size={13} />}
                    </button>
                  );
                })}
              </div>

              <label className="zob-label" style={{ marginBottom: '0.75rem', marginTop: '1.5rem' }}>
                Target Architecture & Framework
              </label>
              <div className="zob-chips-group">
                {STACK_OPTIONS.map((s) => {
                  const isSelected = formData.stack.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      className={`zob-chip-btn ${isSelected ? 'is-selected' : ''}`}
                      onClick={() => toggleStack(s.id)}
                    >
                      <span>{s.label}</span>
                      {isSelected && <Check size={13} />}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* STEP 5: Add First Target */}
          {step === 5 && (
            <section data-testid="onboarding-step-5">
              <span className="zob-eyebrow">Step 5 of 5 • Launch</span>
              <h1 className="zob-title">Add your first site</h1>
              <p className="zob-subtitle">
                Enter your application URL to run an initial passive reconnaissance scan.
              </p>

              <div className="zob-input-group">
                <label className="zob-label" htmlFor="targetUrl">
                  Target Website URL
                </label>
                <input
                  id="targetUrl"
                  type="url"
                  className="zob-input"
                  placeholder="https://app.example.com"
                  value={formData.targetUrl}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, targetUrl: e.target.value }))
                  }
                  autoFocus
                />
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.8rem',
                  color: 'var(--ds-text-secondary, #94a3b8)',
                  padding: '0.75rem 1rem',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--hairline, #242728)',
                }}
              >
                <Shield size={14} color="#34d399" />
                <span>
                  Initial passive scans run non-intrusively without downtime or load spikes.
                </span>
              </div>
            </section>
          )}

          {/* Actions Bottom Bar */}
          <footer className="zob-actions">
            {step > 1 ? (
              <button
                type="button"
                className="zob-btn-back"
                onClick={() => setStep((prev) => prev - 1)}
                disabled={loading}
              >
                <ArrowLeft size={14} style={{ marginRight: '0.35rem', verticalAlign: 'middle' }} />
                Back
              </button>
            ) : (
              <div />
            )}

            <button
              type="button"
              className="zob-btn-next"
              onClick={handleNext}
              disabled={loading}
              data-testid="onboarding-next-btn"
            >
              <span>{step === 5 ? (formData.targetUrl.trim() ? 'Add & Scan' : 'Finish Setup') : 'Continue'}</span>
              <ArrowRight size={14} />
            </button>
          </footer>
        </div>

        <div className="zob-footer-note">
          Minimal data collected • Used only to tailor scan engines and guidance. Review or clear anytime in Settings → Profile.
        </div>
      </div>
    </div>
  );
}
