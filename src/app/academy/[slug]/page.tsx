import ArticleReader from '@/components/academy/ArticleReader';

export default function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  return <ArticleReader params={params} />;
}
