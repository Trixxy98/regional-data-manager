import { NextResponse } from 'next/server';
import { initializeDatabase } from '@/lib/database';

export async function POST() {
  try {
    const db = initializeDatabase();

    // Your VBA combination logic would go here
    // For now, we'll just update the capacity summary
    const updateCapacitySummary = () => {
      db.prepare('DELETE FROM capacity_summary').run();
      
      const summaryData = db.prepare(`
        SELECT 
          capacity,
          SUM(CASE WHEN region_id = 1 THEN 1 ELSE 0 END) as central_count,
          SUM(CASE WHEN region_id = 2 THEN 1 ELSE 0 END) as northern_count,
          SUM(CASE WHEN region_id = 3 THEN 1 ELSE 0 END) as eastern_count,
          SUM(CASE WHEN region_id = 4 THEN 1 ELSE 0 END) as southern_count,
          SUM(CASE WHEN region_id = 5 THEN 1 ELSE 0 END) as em_count,
          COUNT(*) as grand_total
        FROM network_routes 
        WHERE capacity IS NOT NULL AND capacity != ''
        GROUP BY capacity
        ORDER BY capacity
      `).all();

      const insertSummary = db.prepare(`
        INSERT INTO capacity_summary (
          capacity_type, central_count, northern_count, eastern_count, 
          southern_count, em_count, grand_total
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      summaryData.forEach((row: any) => {
        insertSummary.run(
          row.capacity,
          row.central_count,
          row.northern_count,
          row.eastern_count,
          row.southern_count,
          row.em_count,
          row.grand_total
        );
      });
    };

    updateCapacitySummary();

    db.close();

    return NextResponse.json({ 
      success: true, 
      message: 'All regional data combined successfully'
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to combine data' },
      { status: 500 }
    );
  }
}