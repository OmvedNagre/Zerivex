'use client';

import React, { useRef, useEffect, useState } from 'react';
import gsap from 'gsap';

interface StaggeredTextProps {
  text: string;
  className?: string;
  style?: React.CSSProperties;
  staggerDuration?: number;
  initialDelay?: number;
  respectReducedMotion?: boolean;
}

export function StaggeredText({
  text,
  className = '',
  style = {},
  staggerDuration = 0.025,
  initialDelay = 0.1,
  respectReducedMotion = true,
}: StaggeredTextProps) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (!respectReducedMotion || typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [respectReducedMotion]);

  useEffect(() => {
    if (prefersReducedMotion || !containerRef.current) return;

    const letters = containerRef.current.querySelectorAll('.stagger-char');
    if (letters.length === 0) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        letters,
        {
          opacity: 0,
          y: 2,
          filter: 'blur(1px)',
        },
        {
          opacity: 1,
          y: 0,
          filter: 'blur(0px)',
          duration: 0.25,
          delay: initialDelay,
          stagger: staggerDuration,
          ease: 'power2.out',
        }
      );
    }, containerRef);

    return () => ctx.revert();
  }, [text, prefersReducedMotion, staggerDuration, initialDelay]);

  // Split text into characters
  const characters = text.split('');

  return (
    <span
      ref={containerRef}
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        whiteSpace: 'pre',
        ...style,
      }}
      aria-label={text}
    >
      {characters.map((char, index) => (
        <span
          key={`${char}-${index}`}
          className="stagger-char"
          aria-hidden="true"
          style={{
            display: 'inline-block',
            opacity: prefersReducedMotion ? 1 : 0,
            transition: prefersReducedMotion ? 'none' : undefined,
          }}
        >
          {char === ' ' ? '\u00A0' : char}
        </span>
      ))}
    </span>
  );
}
