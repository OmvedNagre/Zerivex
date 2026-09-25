import { NextRequest, NextResponse } from 'next/server';
import { getArticleBySlug } from '@/core/academy/academy-service';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const result = getArticleBySlug(slug);

    if (!result) {
      return NextResponse.json(
        { error: `Security Academy article "${slug}" not found` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to retrieve academy article' },
      { status: 500 }
    );
  }
}
