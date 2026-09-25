import {
  AcademyArticle,
  AcademyArticleSummary,
  AcademyCategory,
  AcademySearchQuery,
  AcademySearchResult,
  LearningTrack,
} from './types';
import { ACADEMY_ARTICLES, LEARNING_TRACKS } from './academy-catalog';

function toSummary(article: AcademyArticle): AcademyArticleSummary {
  return {
    id: article.id,
    slug: article.slug,
    title: article.title,
    summary: article.summary,
    category: article.category,
    trackId: article.trackId,
    difficulty: article.difficulty,
    estimatedReadMinutes: article.estimatedReadMinutes,
    cweId: article.cweId,
    owaspCategory: article.owaspCategory,
    relatedRuleIds: article.relatedRuleIds,
    tags: article.tags,
    updatedAt: article.updatedAt,
  };
}

/**
 * List all available learning tracks.
 */
export function listLearningTracks(): LearningTrack[] {
  return LEARNING_TRACKS;
}

/**
 * Get a learning track by ID with its constituent articles.
 */
export function getLearningTrackById(trackId: string): {
  track: LearningTrack;
  articles: AcademyArticleSummary[];
} | null {
  const track = LEARNING_TRACKS.find((t) => t.id === trackId);
  if (!track) return null;

  const articles = ACADEMY_ARTICLES.filter((a) => track.articleSlugs.includes(a.slug)).map(
    toSummary
  );

  return { track, articles };
}

/**
 * Search and filter security academy articles.
 */
export function searchAcademy(params: AcademySearchQuery = {}): AcademySearchResult {
  let filtered = [...ACADEMY_ARTICLES];

  // 1. Text Search Filter (Title, Summary, Tags, Analysis)
  if (params.query && params.query.trim()) {
    const q = params.query.toLowerCase().trim();
    filtered = filtered.filter((a) => {
      const titleMatch = a.title.toLowerCase().includes(q);
      const summaryMatch = a.summary.toLowerCase().includes(q);
      const tagMatch = a.tags.some((t) => t.toLowerCase().includes(q));
      const ruleMatch = a.relatedRuleIds.some((r) => r.toLowerCase().includes(q));
      const cweMatch = a.cweId?.toLowerCase().includes(q);
      return titleMatch || summaryMatch || tagMatch || ruleMatch || cweMatch;
    });
  }

  // 2. Category Filter
  if (params.category) {
    filtered = filtered.filter((a) => a.category === params.category);
  }

  // 3. Track Filter
  if (params.trackId) {
    filtered = filtered.filter((a) => a.trackId === params.trackId);
  }

  // 4. Difficulty Filter
  if (params.difficulty) {
    filtered = filtered.filter((a) => a.difficulty === params.difficulty);
  }

  // 5. Tag Filter
  if (params.tag) {
    const tagClean = params.tag.toLowerCase().replace(/[^a-z0-9]/g, '');
    filtered = filtered.filter((a) =>
      a.tags.some((t) => t.toLowerCase().replace(/[^a-z0-9]/g, '') === tagClean)
    );
  }

  // 6. Related Rule Filter
  if (params.ruleId) {
    const ruleUpper = params.ruleId.toUpperCase();
    filtered = filtered.filter((a) => a.relatedRuleIds.includes(ruleUpper));
  }

  // Compute category distribution
  const allCategories: AcademyCategory[] = [
    'AI_CODE_SMELLS',
    'API_SECURITY',
    'INJECTION_DEFENSES',
    'AUTHENTICATION_SESSION',
    'INFRASTRUCTURE_HEADERS',
  ];

  const categories = allCategories.map((cat) => ({
    category: cat,
    count: ACADEMY_ARTICLES.filter((a) => a.category === cat).length,
  }));

  const total = filtered.length;

  // Pagination
  const offset = Math.max(0, params.offset || 0);
  const limit = Math.max(1, params.limit || 50);
  const paginated = filtered.slice(offset, offset + limit).map(toSummary);

  return {
    total,
    limit,
    offset,
    articles: paginated,
    tracks: LEARNING_TRACKS,
    categories,
  };
}

/**
 * Get full article details by slug with related recommendations.
 */
export function getArticleBySlug(slug: string): {
  article: AcademyArticle;
  relatedArticles: AcademyArticleSummary[];
} | null {
  const article = ACADEMY_ARTICLES.find((a) => a.slug === slug);
  if (!article) return null;

  // Find related articles (same category or shared tags, excluding self)
  const related = ACADEMY_ARTICLES.filter((a) => {
    if (a.id === article.id) return false;
    const sameCat = a.category === article.category;
    const sharedTags = a.tags.some((t) => article.tags.includes(t));
    return sameCat || sharedTags;
  })
    .slice(0, 3)
    .map(toSummary);

  return { article, relatedArticles: related };
}

/**
 * Find the most relevant security academy article for a scanner check rule.
 */
export function getArticleByRuleId(ruleId: string): AcademyArticle | null {
  const normalized = ruleId.trim().toUpperCase();
  const match = ACADEMY_ARTICLES.find((a) => a.relatedRuleIds.includes(normalized));
  return match || null;
}
