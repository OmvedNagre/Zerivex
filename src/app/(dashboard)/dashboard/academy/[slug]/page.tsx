import ArticleReader from '@/components/academy/ArticleReader';

export default function DashboardArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  return <ArticleReader params={params} embedded />;
}
