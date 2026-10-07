import SmoothScroll from '@/components/motion/SmoothScroll';
import { AnnouncementBar } from '@/components/layout/AnnouncementBar';
import { Header } from '@/components/layout/Header';
import { Hero } from '@/components/landing/Hero';
import { StickyStory } from '@/components/landing/StickyStory';
import { BentoGrid } from '@/components/landing/BentoGrid';
import { BeforeAfterSplit } from '@/components/landing/BeforeAfterSplit';
import { WorksWithMarquee } from '@/components/landing/WorksWithMarquee';
import { CicdBand } from '@/components/landing/CicdBand';
import { StatsAndStatus } from '@/components/landing/StatsAndStatus';
import { VerificationProofCard } from '@/components/landing/VerificationProofCard';
import { AcademyPreview } from '@/components/landing/AcademyPreview';
import { PricingTeaser } from '@/components/landing/PricingTeaser';
import { FaqAccordion } from '@/components/landing/FaqAccordion';
import { FinalCtaCard } from '@/components/landing/FinalCtaCard';
import { Footer } from '@/components/layout/Footer';

export default function HomePage() {
  return (
    <SmoothScroll>
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--ds-bg-page)',
        }}
      >
        {/* 1. Announcement Bar */}
        <AnnouncementBar
          id="zx-announcement-live"
          message="Deterministic Security Engine: Automated Vulnerability Scanning & SSRF Egress Defense Active."
          ctaLabel="Explore Academy"
          ctaHref="/academy"
          dismissible={true}
        />

        {/* 2. Global Chrome: Floating Pill Header with Platform Mega Menu */}
        <Header />

        <main style={{ flex: 1 }}>
          {/* 3. Hero with Live URL-to-Terminal Input */}
          <Hero />

          {/* 4. Verify. Detect. Defend. Sticky Scroll Story */}
          <StickyStory />

          {/* 5. "Mistakes AI Tools Leave Behind" Bento Grid */}
          <BentoGrid />

          {/* 6. Before / After Fix Split (Next.js / Express / Nginx) */}
          <BeforeAfterSplit />

          {/* 7. Works-With Marquee Strip */}
          <WorksWithMarquee />

          {/* 8. CI/CD Band (Inverse Ink Panel with GitHub Actions / GitLab / cURL tabs) */}
          <CicdBand />

          {/* 9. Catalog-Derived Stats Row + Live Observability Status Strip */}
          <StatsAndStatus />

          {/* 10. Fix Verification Protocol Explainer (replaces fabricated testimonials) */}
          <VerificationProofCard />

          {/* 11. Security Academy Preview (6 Cards from ACADEMY_ARTICLES) */}
          <AcademyPreview />

          {/* 12. Compact Pricing Teaser (adaptPlans with Annual Toggle) */}
          <PricingTeaser />

          {/* 13. Frequently Asked Questions (Radix Accordion) */}
          <FaqAccordion />

          {/* 14. Overlapping Final Two-Path CTA Card */}
          <FinalCtaCard />
        </main>

        {/* 15. Global Chrome: Giant Wordmark Footer with Live /api/health Status Pill */}
        <Footer />
      </div>
    </SmoothScroll>
  );
}
