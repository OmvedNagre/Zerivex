import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import {
  ACADEMY_ARTICLES,
  LEARNING_TRACKS,
} from '@/core/academy/academy-catalog';
import {
  listLearningTracks,
  getLearningTrackById,
  getArticleBySlug,
  getArticleByRuleId,
  searchAcademy,
} from '@/core/academy/academy-service';
import { GET as getAcademyList } from '@/app/api/academy/route';
import { GET as getAcademyDetail } from '@/app/api/academy/[slug]/route';

describe('Phase 13: Security Resources & Academy (Educational Content, Knowledge Hub, Remediation Playbooks)', () => {
  // =========================================================================
  // 1. Academy Catalog Integrity & Richness
  // =========================================================================
  describe('1. Academy Catalog Data Integrity', () => {
    it('defines at least 4 structured learning tracks', () => {
      expect(LEARNING_TRACKS.length).toBeGreaterThanOrEqual(4);
      const trackIds = LEARNING_TRACKS.map((t) => t.id);
      expect(trackIds).toContain('ai-code-smells');
      expect(trackIds).toContain('api-modern-web');
      expect(trackIds).toContain('injection-sanitization');
      expect(trackIds).toContain('identity-rbac-tenancy');
    });

    it('contains at least 10 production-grade educational articles', () => {
      expect(ACADEMY_ARTICLES.length).toBeGreaterThanOrEqual(10);
    });

    it('ensures all article IDs and slugs are unique and URL-friendly', () => {
      const ids = new Set<string>();
      const slugs = new Set<string>();

      for (const article of ACADEMY_ARTICLES) {
        expect(ids.has(article.id)).toBe(false);
        ids.add(article.id);

        expect(slugs.has(article.slug)).toBe(false);
        slugs.add(article.slug);

        expect(article.slug).toMatch(/^[a-z0-9-]+$/);
      }
    });

    it('validates every article contains required metadata, CWE, OWASP, and AI pitfall context', () => {
      for (const article of ACADEMY_ARTICLES) {
        expect(article.title.trim().length).toBeGreaterThan(5);
        expect(article.summary.trim().length).toBeGreaterThan(20);
        expect(article.cweId).toMatch(/^CWE-\d+$/);
        expect(article.owaspCategory).toMatch(/^A\d{2}:\d{4}/);
        expect(article.aiPitfallDescription.trim().length).toBeGreaterThan(30);
        expect(article.estimatedReadMinutes).toBeGreaterThan(0);
        expect(article.tags.length).toBeGreaterThanOrEqual(2);
      }
    });

    it('validates every article has multiple framework remediation snippets with complete explanations', () => {
      for (const article of ACADEMY_ARTICLES) {
        expect(article.remediationSnippets.length).toBeGreaterThanOrEqual(2);
        for (const snippet of article.remediationSnippets) {
          expect(['nextjs', 'express', 'nginx', 'fastify', 'general']).toContain(snippet.framework);
          expect(snippet.code.trim().length).toBeGreaterThan(20);
          expect(snippet.explanation.trim().length).toBeGreaterThan(15);
        }
      }
    });

    it('validates every article provides executable CLI diagnostic commands and self-audit checklists', () => {
      for (const article of ACADEMY_ARTICLES) {
        expect(article.cliVerification.length).toBeGreaterThanOrEqual(1);
        for (const cmd of article.cliVerification) {
          expect(cmd.tool).toBeDefined();
          expect(cmd.command.trim().length).toBeGreaterThan(5);
          expect(cmd.expectedOutput.trim().length).toBeGreaterThan(5);
        }

        expect(article.checklist.length).toBeGreaterThanOrEqual(2);
        for (const item of article.checklist) {
          expect(item.trim().length).toBeGreaterThan(5);
        }
      }
    });

    it('verifies bi-directional integrity between tracks and article slugs', () => {
      const allArticleSlugs = new Set(ACADEMY_ARTICLES.map((a) => a.slug));

      for (const track of LEARNING_TRACKS) {
        expect(track.articleSlugs.length).toBeGreaterThan(0);
        for (const slug of track.articleSlugs) {
          expect(allArticleSlugs.has(slug)).toBe(true);
        }
      }

      for (const article of ACADEMY_ARTICLES) {
        const parentTrack = LEARNING_TRACKS.find((t) => t.id === article.trackId);
        expect(parentTrack).toBeDefined();
        expect(parentTrack?.articleSlugs).toContain(article.slug);
      }
    });
  });

  // =========================================================================
  // 2. Academy Service Engine
  // =========================================================================
  describe('2. Academy Service Engine', () => {
    it('listLearningTracks returns all defined tracks', () => {
      const tracks = listLearningTracks();
      expect(tracks.length).toBe(LEARNING_TRACKS.length);
      expect(tracks[0]).toHaveProperty('id');
      expect(tracks[0]).toHaveProperty('title');
      expect(tracks[0]).toHaveProperty('icon');
    });

    it('getLearningTrackById resolves track by ID and returns null for unknown', () => {
      const track = getLearningTrackById('ai-code-smells');
      expect(track).toBeDefined();
      expect(track?.track.title).toContain('AI Code Smells');

      const missing = getLearningTrackById('non-existent-track' as any);
      expect(missing).toBeNull();
    });

    it('getArticleBySlug retrieves article and computes related articles without self-inclusion', () => {
      const result = getArticleBySlug('overly-permissive-cors');
      expect(result).not.toBeNull();
      expect(result?.article.slug).toBe('overly-permissive-cors');
      expect(result?.relatedArticles).toBeDefined();

      // Related articles must not include the target article itself
      const relatedSlugs = result!.relatedArticles.map((a) => a.slug);
      expect(relatedSlugs).not.toContain('overly-permissive-cors');

      const nonExistent = getArticleBySlug('unreal-article-xyz');
      expect(nonExistent).toBeNull();
    });

    it('getArticleByRuleId resolves exact scanner finding rule IDs', () => {
      const corsGuide = getArticleByRuleId('ZX-CORS-001');
      expect(corsGuide).not.toBeNull();
      expect(corsGuide?.slug).toBe('overly-permissive-cors');

      const secretsGuide = getArticleByRuleId('ZX-SECRETS-001');
      expect(secretsGuide).not.toBeNull();
      // ZX-SECRETS-001 is mapped to securing-ai-generated-code or client-side-secret-leakage
      expect(['securing-ai-generated-code', 'client-side-secret-leakage']).toContain(secretsGuide?.slug);

      const ssrfGuide = getArticleByRuleId('ZX-SSRF-001');
      expect(ssrfGuide).not.toBeNull();
      expect(ssrfGuide?.slug).toBe('ssrf-defense-in-depth');

      const unmapped = getArticleByRuleId('ZX-NONEXISTENT-999');
      expect(unmapped).toBeNull();
    });

    describe('searchAcademy Query & Filtering Engine', () => {
      it('returns all articles when called with no filters', () => {
        const res = searchAcademy();
        expect(res.total).toBe(ACADEMY_ARTICLES.length);
        expect(res.articles.length).toBe(ACADEMY_ARTICLES.length);
      });

      it('searches by keyword across titles, summaries, tags, and rule IDs', () => {
        const corsRes = searchAcademy({ query: 'CORS' });
        expect(corsRes.total).toBeGreaterThanOrEqual(1);
        expect(corsRes.articles.some((a) => a.slug === 'overly-permissive-cors')).toBe(true);

        const cweRes = searchAcademy({ query: 'CWE-89' });
        expect(cweRes.total).toBeGreaterThanOrEqual(1);
        expect(cweRes.articles.some((a) => a.slug === 'sql-injection-modern-orms')).toBe(true);

        const ruleRes = searchAcademy({ query: 'ZX-XSS-001' });
        expect(ruleRes.total).toBeGreaterThanOrEqual(1);
        expect(ruleRes.articles.some((a) => a.slug === 'xss-react-hydration')).toBe(true);
      });

      it('filters articles by category', () => {
        const aiSmells = searchAcademy({ category: 'AI_CODE_SMELLS' });
        expect(aiSmells.total).toBeGreaterThanOrEqual(2);
        for (const a of aiSmells.articles) {
          expect(a.category).toBe('AI_CODE_SMELLS');
        }
      });

      it('filters articles by difficulty level', () => {
        const advanced = searchAcademy({ difficulty: 'ADVANCED' });
        expect(advanced.total).toBeGreaterThanOrEqual(1);
        for (const a of advanced.articles) {
          expect(a.difficulty).toBe('ADVANCED');
        }
      });

      it('filters articles by track ID', () => {
        const trackRes = searchAcademy({ trackId: 'identity-rbac-tenancy' });
        expect(trackRes.total).toBeGreaterThanOrEqual(2);
        for (const a of trackRes.articles) {
          expect(a.trackId).toBe('identity-rbac-tenancy');
        }
      });

      it('filters articles by tag', () => {
        const tagRes = searchAcademy({ tag: 'nextjs' });
        expect(tagRes.total).toBeGreaterThanOrEqual(3);
        for (const a of tagRes.articles) {
          expect(a.tags.some((t) => t.toLowerCase().includes('next'))).toBe(true);
        }
      });

      it('supports pagination with offset and limit', () => {
        const page1 = searchAcademy({ limit: 3, offset: 0 });
        expect(page1.articles.length).toBe(3);
        expect(page1.limit).toBe(3);
        expect(page1.offset).toBe(0);

        const page2 = searchAcademy({ limit: 3, offset: 3 });
        expect(page2.articles.length).toBe(3);
        expect(page2.offset).toBe(3);

        // Ensure page 1 and page 2 articles do not overlap
        const page1Slugs = new Set(page1.articles.map((a) => a.slug));
        for (const a of page2.articles) {
          expect(page1Slugs.has(a.slug)).toBe(false);
        }
      });
    });
  });

  // =========================================================================
  // 3. Academy REST API Routes
  // =========================================================================
  describe('3. Academy REST API Handlers', () => {
    it('GET /api/academy returns articles list, tracks, and total counts', async () => {
      const req = new NextRequest('http://localhost:3000/api/academy');
      const response = await getAcademyList(req);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.total).toBe(ACADEMY_ARTICLES.length);
      expect(data.articles.length).toBe(ACADEMY_ARTICLES.length);
      expect(data.tracks.length).toBe(LEARNING_TRACKS.length);
    });

    it('GET /api/academy handles query string filters', async () => {
      const req = new NextRequest('http://localhost:3000/api/academy?category=API_SECURITY&difficulty=BEGINNER');
      const response = await getAcademyList(req);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      for (const a of data.articles) {
        expect(a.category).toBe('API_SECURITY');
        expect(a.difficulty).toBe('BEGINNER');
      }
    });

    it('GET /api/academy/[slug] returns full article details and related playbooks', async () => {
      const req = new NextRequest('http://localhost:3000/api/academy/overly-permissive-cors');
      const response = await getAcademyDetail(req, {
        params: Promise.resolve({ slug: 'overly-permissive-cors' }),
      });
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.article.slug).toBe('overly-permissive-cors');
      expect(data.data.article.remediationSnippets.length).toBeGreaterThanOrEqual(2);
      expect(data.data.article.cliVerification.length).toBeGreaterThanOrEqual(1);
      expect(data.data.relatedArticles.length).toBeGreaterThanOrEqual(1);
    });

    it('GET /api/academy/[slug] returns 404 for unknown article slug', async () => {
      const req = new NextRequest('http://localhost:3000/api/academy/unknown-security-slug');
      const response = await getAcademyDetail(req, {
        params: Promise.resolve({ slug: 'unknown-security-slug' }),
      });
      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data.error).toContain('not found');
    });
  });

  // =========================================================================
  // 4. Bi-Directional Finding Linkage & Rule Coverage
  // =========================================================================
  describe('4. Bi-Directional Scanner Rule Coverage', () => {
    it('covers all core scanner finding rule families with actionable playbooks', () => {
      const coreRuleFamilies = [
        'ZX-AI-SMELL-001',
        'ZX-CORS-001',
        'ZX-SECRETS-001',
        'ZX-SSRF-001',
        'ZX-SEC-API-001',
        'ZX-SQLI-001',
        'ZX-XSS-001',
        'ZX-HEADERS-001',
        'ZX-AUTH-001',
        'ZX-SESS-001',
        'ZX-COOKIE-001',
      ];

      for (const ruleId of coreRuleFamilies) {
        const article = getArticleByRuleId(ruleId);
        expect(article, `Missing Academy article playbook for rule ${ruleId}`).toBeDefined();
        expect(article?.relatedRuleIds).toContain(ruleId);
        expect(article?.remediationSnippets.length).toBeGreaterThanOrEqual(2);
        expect(article?.cliVerification.length).toBeGreaterThanOrEqual(1);
      }
    });
  });
});
