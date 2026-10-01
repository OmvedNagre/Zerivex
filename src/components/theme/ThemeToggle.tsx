'use client';

import { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from './ThemeProvider';
import { StaggeredText } from '@/components/ui/StaggeredText';

export interface ThemeToggleProps {
  showLabel?: boolean;
  className?: string;
  size?: 'sm' | 'md';
  id?: string;
  disabled?: boolean;
}

export function ThemeToggle({
  showLabel = false,
  className = '',
  size = 'md',
  id,
  disabled = false,
}: ThemeToggleProps) {
  const { theme, toggleTheme, mounted } = useTheme();
  const moonIconRef = useRef<HTMLSpanElement>(null);
  const sunIconRef = useRef<HTMLSpanElement>(null);
  const isFirstRender = useRef(true);
  const prevThemeRef = useRef(theme);

  const isDark = theme === 'dark';
  const iconSize = size === 'sm' ? 16 : 18;

  // GSAP scoped animation with matchMedia for prefers-reduced-motion support
  useEffect(() => {
    if (!mounted) return;

    // Skip animation on initial client mount to prevent FOUC / unwanted rotation on page load
    if (isFirstRender.current) {
      isFirstRender.current = false;
      prevThemeRef.current = theme;

      if (moonIconRef.current && sunIconRef.current) {
        if (theme === 'dark') {
          gsap.set(moonIconRef.current, { opacity: 1, scale: 1, rotation: 0 });
          gsap.set(sunIconRef.current, { opacity: 0, scale: 0.6, rotation: -45 });
        } else {
          gsap.set(sunIconRef.current, { opacity: 1, scale: 1, rotation: 0 });
          gsap.set(moonIconRef.current, { opacity: 0, scale: 0.6, rotation: 45 });
        }
      }
      return;
    }

    if (prevThemeRef.current === theme) return;
    prevThemeRef.current = theme;

    const mm = gsap.matchMedia();

    mm.add(
      {
        reduceMotion: '(prefers-reduced-motion: reduce)',
        allowMotion: '(prefers-reduced-motion: no-preference)',
      },
      (context) => {
        const { reduceMotion } = context.conditions as {
          reduceMotion?: boolean;
          allowMotion?: boolean;
        };

        // Terminate any in-flight tweens on rapid clicks to prevent state de-sync
        if (moonIconRef.current) gsap.killTweensOf(moonIconRef.current);
        if (sunIconRef.current) gsap.killTweensOf(sunIconRef.current);

        if (reduceMotion) {
          // Instant state swap respecting prefers-reduced-motion
          if (theme === 'dark') {
            gsap.set(moonIconRef.current, { opacity: 1, scale: 1, rotation: 0 });
            gsap.set(sunIconRef.current, { opacity: 0, scale: 0.6, rotation: -45 });
          } else {
            gsap.set(sunIconRef.current, { opacity: 1, scale: 1, rotation: 0 });
            gsap.set(moonIconRef.current, { opacity: 0, scale: 0.6, rotation: 45 });
          }
        } else {
          // Precise, mechanical icon choreography (restrained duration & easing)
          if (theme === 'dark') {
            // Sun exits
            gsap.to(sunIconRef.current, {
              opacity: 0,
              scale: 0.6,
              rotation: -45,
              duration: 0.18,
              ease: 'power2.in',
            });
            // Moon arrives
            gsap.fromTo(
              moonIconRef.current,
              { opacity: 0, scale: 0.7, rotation: 45 },
              {
                opacity: 1,
                scale: 1,
                rotation: 0,
                duration: 0.24,
                delay: 0.04,
                ease: 'power2.out',
              }
            );
          } else {
            // Moon exits
            gsap.to(moonIconRef.current, {
              opacity: 0,
              scale: 0.6,
              rotation: 45,
              duration: 0.18,
              ease: 'power2.in',
            });
            // Sun arrives
            gsap.fromTo(
              sunIconRef.current,
              { opacity: 0, scale: 0.7, rotation: -45 },
              {
                opacity: 1,
                scale: 1,
                rotation: 0,
                duration: 0.24,
                delay: 0.04,
                ease: 'power2.out',
              }
            );
          }
        }
      }
    );

    return () => {
      mm.revert();
    };
  }, [theme, mounted]);

  // Client mounting skeleton: identical 44x44px bounding box to eliminate Cumulative Layout Shift (CLS)
  if (!mounted) {
    return (
      <div
        className={`zh-theme-toggle zh-theme-toggle-skeleton ${
          size === 'sm' ? 'zh-theme-toggle-sm' : 'zh-theme-toggle-md'
        } ${showLabel ? 'zh-theme-toggle-with-label' : ''} ${className}`.trim()}
        aria-hidden="true"
        style={{
          width: showLabel ? undefined : '44px',
          height: '44px',
          minWidth: showLabel ? '88px' : '44px',
          minHeight: '44px',
          pointerEvents: 'none',
        }}
      />
    );
  }

  const actionText = isDark ? 'Switch to light mode' : 'Switch to dark mode';

  return (
    <button
      type="button"
      id={id || 'theme-toggle-btn'}
      onClick={toggleTheme}
      disabled={disabled}
      aria-label={actionText}
      title={actionText}
      aria-live="polite"
      className={`zh-theme-toggle ${
        size === 'sm' ? 'zh-theme-toggle-sm' : 'zh-theme-toggle-md'
      } ${showLabel ? 'zh-theme-toggle-with-label' : ''} ${className}`.trim()}
      style={{
        width: showLabel ? undefined : '44px',
        height: '44px',
        minWidth: showLabel ? '88px' : '44px',
        minHeight: '44px',
      }}
    >
      <span className="zh-theme-toggle-icon-box" aria-hidden="true">
        <span
          ref={moonIconRef}
          className="zh-theme-toggle-icon moon"
          style={{
            opacity: isDark ? 1 : 0,
            transform: isDark ? 'none' : 'rotate(45deg) scale(0.6)',
          }}
        >
          <Moon size={iconSize} strokeWidth={1.75} />
        </span>
        <span
          ref={sunIconRef}
          className="zh-theme-toggle-icon sun"
          style={{
            opacity: isDark ? 0 : 1,
            transform: isDark ? 'rotate(-45deg) scale(0.6)' : 'none',
          }}
        >
          <Sun size={iconSize} strokeWidth={1.75} />
        </span>
      </span>

      {showLabel && (
        <span className="zh-theme-toggle-label">
          <StaggeredText
            key={theme}
            text={isDark ? 'DARK' : 'LIGHT'}
            staggerDuration={0.03}
            initialDelay={0.04}
          />
        </span>
      )}
    </button>
  );
}
