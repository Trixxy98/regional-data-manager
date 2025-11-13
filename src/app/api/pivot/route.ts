import { NextResponse } from 'next/server';
import { initializeDatabase } from '@/lib/database';

export async function GET() {
  const db = initializeDatabase();
  
  const pivotData = db.prepare(`
    SELECT 
      capacity_type as equipment_name,
      central_count,
      northern_count,
      eastern_count,
      southern_count,
      em_count,
      grand_total
    FROM capacity_summary
    ORDER BY grand_total DESC
  `).all();

  db.close();

  return NextResponse.json(pivotData);
}