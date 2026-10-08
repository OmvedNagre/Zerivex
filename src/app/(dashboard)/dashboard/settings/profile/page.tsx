'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Save,
  CheckCircle2,
  AlertTriangle,
  GraduationCap,
  Wrench,
  Building2,
  Rocket,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';

const PERSONA_CHOICES = [
  { id: 'STUDENT', label: 'Student', desc: 'Learning AppSec & building portfolio', icon: GraduationCap },
  { id: 'SOLO_BUILDER', label: 'Solo Builder', desc: 'Indie hacker shipping autonomous tools', icon: Wrench },
  { id: 'FREELANCER_AGENCY', label: 'Freelancer / Agency', desc: 'Securing client sites & deliverables', icon: Building2 },
  { id: 'STARTUP_FOUNDER', label: 'Startup Founder', desc: 'Compliance & security before launch', icon: Rocket },
  { id: 'COMPANY_TEAM', label: 'Company Team', desc: 'Multi-repo engineering & DevSecOps', icon: ShieldCheck },
];

const ALL_GOALS = [
  { id: 'CHECK_APP', label: 'Check my app for vulnerabilities' },
  { id: 'LEARN_SECURITY', label: 'Learn security best practices' },
  { id: 'PROTECT_CLIENTS', label: 'Protect & monitor client sites' },
  { id: 'SETUP_CI_GATE', label: 'Set up a CI quality gate' },
  { id: 'SHOW_COMPLIANCE', label: 'Show customers we are secure' },
];

const ALL_TOOLS = [
  { id: 'CURSOR', label: 'Cursor' },
  { id: 'LOVABLE', label: 'Lovable' },
  { id: 'V0', label: 'v0' },
  { id: 'BOLT', label: 'Bolt' },
  { id: 'CLAUDE_CODE', label: 'Claude Code' },
  { id: 'HAND_CODED', label: 'Hand-coded' },
  { id: 'OTHER', label: 'Other' },
];

const ALL_STACKS = [
  { id: 'NEXTJS', label: 'Next.js / React' },
  { id: 'EXPRESS', label: 'Node / Express' },
  { id: 'NGINX', label: 'Nginx / Static' },
  { id: 'OTHER', label: 'Other' },
];

export default function ProfileSettingsPage() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState('');
  const [persona, setPersona] = useState('SOLO_BUILDER');
  const [goals, setGoals] = useState<string[]>([]);
  const [builtWith, setBuiltWith] = useState<string[]>([]);
  const [stack, setStack] = useState<string[]>([]);
  const [teamSize, setTeamSize] = useState('');

  useEffect(() => {
    async function loadProfile() {
      try {
        setLoading(true);
        const res = await fetch('/api/me/profile');
        const data = await res.json();
        if (data.success && data.data.profile) {
          const p = data.data.profile;
          setDisplayName(p.displayName || user?.displayName || '');
          setPersona(p.persona || 'SOLO_BUILDER');
          setGoals(p.goals || []);
          setBuiltWith(p.builtWith || []);
          setStack(p.stack || []);
          setTeamSize(p.teamSize || '');
        } else if (user?.displayName) {
          setDisplayName(user.displayName);
        }
      } catch (err) {
        console.error('Failed to load profile:', err);
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/me/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName,
          persona,
          goals,
          builtWith,
          stack,
          teamSize: teamSize || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update profile');
      }

      setSuccessMsg('Profile and preferences updated successfully.');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const toggleItem = (list: string[], setList: (v: string[]) => void, id: string) => {
    if (list.includes(id)) {
      setList(list.filter((x) => x !== id));
    } else {
      setList([...list, id]);
    }
  };

  if (loading) {
    return (
      <div className="container" style={{ padding: '2.5rem 1.5rem 5rem', maxWidth: '840px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-secondary)' }}>
          <div
            style={{
              width: '18px',
              height: '18px',
              border: '2px solid var(--border-subtle)',
              borderTopColor: 'var(--brand, #f97316)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          <p style={{ margin: 0, fontSize: '0.9rem' }}>Loading profile preferences...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '2.5rem 1.5rem 5rem', maxWidth: '840px' }}>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
        <Link href="/dashboard" style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
          <ArrowLeft size={14} /> Dashboard
        </Link>
        <span style={{ color: 'var(--text-muted)' }}>/</span>
        <span style={{ color: 'var(--text-primary)' }}>Profile & Persona</span>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
          Profile & Personalization
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Customize your persona, security goals, and framework preferences to tailor dashboard adapters and remediation guides.
        </p>
      </div>

      {successMsg && (
        <div
          style={{
            padding: '1rem',
            backgroundColor: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: 'var(--radius-md)',
            color: '#34d399',
            fontSize: '0.88rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '1.5rem',
          }}
        >
          <CheckCircle2 size={16} />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div
          style={{
            padding: '1rem',
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-md)',
            color: '#f87171',
            fontSize: '0.88rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '1.5rem',
          }}
        >
          <AlertTriangle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="card" style={{ padding: '2rem' }}>
        {/* Basic Info */}
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)' }}>
            Personal Details
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'rgba(0,0,0,0.25)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                Team Size (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. 1-5 engineers"
                value={teamSize}
                onChange={(e) => setTeamSize(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'rgba(0,0,0,0.25)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                }}
              />
            </div>
          </div>
        </div>

        {/* Persona */}
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-primary)' }}>
            Role & Persona
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Shapes default sidebar layout and Academy recommendation order.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
            {PERSONA_CHOICES.map((p) => {
              const Icon = p.icon;
              const isSelected = persona === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => setPersona(p.id)}
                  style={{
                    padding: '1rem',
                    borderRadius: 'var(--radius-md)',
                    border: `1px solid ${isSelected ? 'var(--brand, #f97316)' : 'var(--border-subtle)'}`,
                    backgroundColor: isSelected ? 'rgba(249, 115, 22, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Icon size={18} color={isSelected ? '#f97316' : 'var(--text-secondary)'} style={{ marginTop: '0.1rem', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
                      {p.label}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>
                      {p.desc}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Goals */}
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-primary)' }}>
            Security Goals
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Reorders priority for Next Best Action suggestions on the overview dashboard.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {ALL_GOALS.map((g) => {
              const isSelected = goals.includes(g.id);
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => toggleItem(goals, setGoals, g.id)}
                  style={{
                    padding: '0.45rem 0.85rem',
                    borderRadius: '9999px',
                    border: `1px solid ${isSelected ? '#f97316' : 'var(--border-subtle)'}`,
                    backgroundColor: isSelected ? 'rgba(249, 115, 22, 0.12)' : 'rgba(255,255,255,0.03)',
                    color: isSelected ? '#fb923c' : 'var(--text-secondary)',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}
                >
                  <span>{g.label}</span>
                  {isSelected && <Check size={12} />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tools */}
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-primary)' }}>
            Tools & IDEs
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            AI coding agents, assistants, and hand-crafted tooling used to build your projects.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {ALL_TOOLS.map((t) => {
              const isSelected = builtWith.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleItem(builtWith, setBuiltWith, t.id)}
                  style={{
                    padding: '0.45rem 0.85rem',
                    borderRadius: '9999px',
                    border: `1px solid ${isSelected ? '#f97316' : 'var(--border-subtle)'}`,
                    backgroundColor: isSelected ? 'rgba(249, 115, 22, 0.12)' : 'rgba(255,255,255,0.03)',
                    color: isSelected ? '#fb923c' : 'var(--text-secondary)',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}
                >
                  <span>{t.label}</span>
                  {isSelected && <Check size={12} />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Stack & Framework */}
        <div style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-primary)' }}>
            Architecture & Framework
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Configures the default framework tab in code fix snippets and Academy walkthroughs.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.25rem' }}>
            {ALL_STACKS.map((s) => {
              const isSelected = stack.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleItem(stack, setStack, s.id)}
                  style={{
                    padding: '0.45rem 0.85rem',
                    borderRadius: '9999px',
                    border: `1px solid ${isSelected ? '#f97316' : 'var(--border-subtle)'}`,
                    backgroundColor: isSelected ? 'rgba(249, 115, 22, 0.12)' : 'rgba(255,255,255,0.03)',
                    color: isSelected ? '#fb923c' : 'var(--text-secondary)',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}
                >
                  <span>{s.label}</span>
                  {isSelected && <Check size={12} />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Submit */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '1.5rem', borderTop: '1px solid var(--border-subtle)' }}>
          <button
            type="submit"
            disabled={saving}
            className="zx-btn zx-btn--brand"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.88rem',
              padding: '0.65rem 1.5rem',
            }}
          >
            <Save size={14} />
            <span>{saving ? 'Saving Preferences...' : 'Save Profile Preferences'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
