import { NextResponse } from 'next/server';
import { initializeDatabase } from '@/lib/database';

export async function GET() {
  const db = initializeDatabase();
  const regions = db.prepare('SELECT * FROM regions').all();
  db.close();
  return NextResponse.json(regions);
}