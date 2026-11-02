import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getWorkerHealth } from '@/core/scanner/worker-health';
export async function GET(req: NextRequest) {
  const secret=process.env.WORKER_MONITOR_SECRET;
  const supplied=req.headers.get('authorization') || '';
  const expected=Buffer.from(`Bearer ${secret}`);
  const suppliedBytes=Buffer.from(supplied);
  if(!secret || secret.length<32 || suppliedBytes.length!==expected.length || !crypto.timingSafeEqual(suppliedBytes,expected)) return NextResponse.json({error:'Unauthorized'},{status:401});
  try {const health=await getWorkerHealth();return NextResponse.json({status:health.online && !health.overdue ? 'healthy':'degraded',online:health.online,overdue:health.overdue,checkedAt:health.checkedAt},{status:health.online && !health.overdue ? 200:503,headers:{'Cache-Control':'no-store'}});}
  catch{return NextResponse.json({status:'unavailable'},{status:503});}
}
