import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    {
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime ? process.uptime() : 0),
    },
    { status: 200 }
  );
}
