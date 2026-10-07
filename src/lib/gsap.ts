import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

/**
 * Check if the user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Animate numeric counter from start to end value
 */
export function animateCounter(
  target: { value: number },
  endValue: number,
  onUpdate: (val: number) => void,
  duration = 1.2
) {
  if (prefersReducedMotion()) {
    onUpdate(endValue);
    return;
  }

  gsap.to(target, {
    value: endValue,
    duration,
    ease: 'power2.out',
    onUpdate: () => onUpdate(Math.round(target.value)),
  });
}

/**
 * Animate circular score gauge sweep from 0 to value
 */
export function animateGauge(
  circleElement: SVGPathElement | SVGCircleElement | null,
  percent: number,
  duration = 1.4
) {
  if (!circleElement) return;
  if (prefersReducedMotion()) {
    gsap.set(circleElement, { strokeDashoffset: 100 - percent });
    return;
  }

  gsap.fromTo(
    circleElement,
    { strokeDashoffset: 100 },
    {
      strokeDashoffset: 100 - percent,
      duration,
      ease: 'power2.out',
    }
  );
}

export { gsap, ScrollTrigger };
