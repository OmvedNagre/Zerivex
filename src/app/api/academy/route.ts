import { NextRequest, NextResponse } from 'next/server';
import { searchAcademy } from '@/core/academy/academy-service';
import { AcademyCategory, DifficultyLevel, LearningTrackId } from '@/core/academy/types';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;

    const query = searchParams.get('q') || undefined;
    const category = (searchParams.get('category') as AcademyCategory) || undefined;
    const trackId = (searchParams.get('trackId') as LearningTrackId) || undefined;
    const difficulty = (searchParams.get('difficulty') as DifficultyLevel) || undefined;
    const tag = searchParams.get('tag') || undefined;
    const ruleId = searchParams.get('ruleId') || undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : undefined;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!, 10) : undefined;

    const results = searchAcademy({
      query,
      category,
      trackId,
      difficulty,
      tag,
      ruleId,
      limit,
      offset,
    });

    return NextResponse.json({
      success: true,
      total: results.total,
      limit: results.limit,
      offset: results.offset,
      articles: results.articles,
      tracks: results.tracks,
      categories: results.categories,
      data: results,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to search academy' },
      { status: 500 }
    );
  }
}
