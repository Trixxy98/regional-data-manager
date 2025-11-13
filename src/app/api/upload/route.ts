import { NextRequest, NextResponse } from 'next/server';
import { initializeDatabase } from '@/lib/database';
import * as XLSX from 'xlsx';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const regionId = formData.get('regionId') as string;

    if (!file || !regionId) {
      return NextResponse.json(
        { error: 'File and region are required' },
        { status: 400 }
      );
    }

    const db = initializeDatabase();

    // Record the source file
    const insertFile = db.prepare(`
      INSERT INTO source_files (filename, region_id) 
      VALUES (?, ?)
    `);
    const fileInfo = insertFile.run(file.name, parseInt(regionId));
    const sourceFileId = fileInfo.lastInsertRowid;

    // Parse Excel file
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    
    // Look for Summary1 sheet (as in your VBA)
    const sheetName = workbook.SheetNames.find(name => 
      name.toLowerCase().includes('summary1')
    ) || workbook.SheetNames[0];
    
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    // Find header row and extract data
    const headerRowIndex = jsonData.findIndex((row: any) => 
      row && row.length > 0 && 
      ['Node', 'NE_IP', 'IDU', 'Capacity'].some(header => 
        String(row[0]).includes(header)
      )
    );

    if (headerRowIndex === -1) {
      return NextResponse.json(
        { error: 'Could not find valid header row in Excel file' },
        { status: 400 }
      );
    }

    const headers = jsonData[headerRowIndex] as string[];
    const dataRows = jsonData.slice(headerRowIndex + 1);

    // Prepare statement for inserting network routes
    const insertRoute = db.prepare(`
      INSERT INTO network_routes (
        region_id, node, ne_ip, idu, capacity, location, parallel, main_stby,
        site_id_a, lrd_a, site_id_b, lrd_b, uplink, link_count, protection,
        remote_ip, remote_slot, l3_port, ras, hostname, link, qam, source_file_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Process each data row
    let processedCount = 0;
    for (const row of dataRows) {
      if (!row || row.length < headers.length) continue;

      try {
        insertRoute.run(
          parseInt(regionId),
          row[0] || '', // Node
          row[1] || '', // NE_IP
          row[2] || '', // IDU
          row[3] || '', // Capacity
          row[4] || '', // Location
          row[5] || '', // Parallel
          row[6] || '', // MainStby
          row[7] || '', // SiteID_A
          row[8] || '', // LRD_A
          row[9] || '', // SiteID_B
          row[10] || '', // LRD_B
          row[11] || '', // Uplink
          row[12] || '', // LinkCount
          row[13] || '', // Protection
          row[14] || '', // RemoteIP
          row[15] || '', // RemoteSlot
          row[16] || '', // L3PORT
          row[17] || '', // RAS
          row[18] || '', // Hostname
          row[19] || '', // link
          row[20] || '', // QAM
          sourceFileId
        );
        processedCount++;
      } catch (error) {
        console.error('Error inserting row:', error);
      }
    }

    // Update capacity summary
    updateCapacitySummary(db);

    db.close();

    return NextResponse.json({ 
      success: true, 
      message: `Imported ${processedCount} network routes successfully`,
      recordsProcessed: processedCount
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to process file' },
      { status: 500 }
    );
  }
}

function updateCapacitySummary(db: any) {
  // Clear existing summary
  db.prepare('DELETE FROM capacity_summary').run();

  // Generate capacity summary by region
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

  // Insert into capacity summary table
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
}