import { NextResponse } from 'next/server';

/** Plan-preview privileges have been retired. Customer plans follow subscriptions. */
export async function POST() { return NextResponse.json({ error: 'Not found' }, { status: 404 }); }
