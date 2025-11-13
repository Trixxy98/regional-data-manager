import { NextRequest, NextResponse } from 'next/server';
import { initializeDatabase } from '@/lib/database';
import * as XLSX from 'xlsx';

interface ExcelRow {
  [key: number]: any;
}

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
    
    console.log('Sheet names:', workbook.SheetNames);
    
    // Use first sheet
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Get the raw data
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as ExcelRow[];
    
    console.log('Total rows in Excel:', rawData.length);
    console.log('First row (headers):', rawData[0]);

    // Find header row - very flexible search
    const headerRowIndex = rawData.findIndex((row: ExcelRow) => {
      if (!row || Object.keys(row).length === 0) return false;
      
      const firstCell = String(row[0] || '').toLowerCase();
      return firstCell.includes('node') || firstCell.includes('ne') || firstCell.includes('idu');
    });

    if (headerRowIndex === -1) {
      console.log('No header found. Using first row as header.');
      // Use first row as header if no clear header found
      const firstRow = rawData[0];
      if (firstRow && Object.keys(firstRow).length > 0) {
        // Assume first row is header
        const headerRowIndex = 0;
      } else {
        return NextResponse.json(
          { error: 'Could not find valid data in Excel file.' },
          { status: 400 }
        );
      }
    }

    console.log('Header found at row:', headerRowIndex);

    const headers = rawData[headerRowIndex];
    const dataRows = rawData.slice(headerRowIndex + 1).filter(row => 
      row && Object.keys(row).length > 0 && String(row[0] || '').trim() !== ''
    );
    
    console.log('Data rows to process:', dataRows.length);
    console.log('Headers:', headers);

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
    let errorCount = 0;

    for (const row of dataRows) {
      try {
        // Map columns based on header names
        const headerMap: {[key: string]: number} = {};
        Object.keys(headers).forEach(key => {
          const headerName = String(headers[Number(key)] || '').toLowerCase();
          headerMap[headerName] = Number(key);
        });

        // Extract data using header mapping (case insensitive)
        const getValue = (fieldName: string): string => {
          const possibleHeaders = Object.keys(headerMap).filter(header => 
            header.includes(fieldName.toLowerCase())
          );
          if (possibleHeaders.length > 0) {
            const headerKey = possibleHeaders[0];
            return String(row[headerMap[headerKey]] ?? '').trim();
          }
          return '';
        };

        insertRoute.run(
          parseInt(regionId),
          getValue('node') || String(row[0] ?? '').trim(), // Node
          getValue('ne ip') || getValue('ne_ip') || String(row[1] ?? '').trim(), // NE_IP
          getValue('idu') || String(row[2] ?? '').trim(), // IDU
          getValue('capacity') || String(row[3] ?? '').trim(), // Capacity
          getValue('location') || String(row[4] ?? '').trim(), // Location
          getValue('parallel') || String(row[5] ?? '').trim(), // Parallel
          getValue('mainstby') || getValue('main') || String(row[6] ?? '').trim(), // MainStby
          getValue('siteid_a') || getValue('siteid') || String(row[7] ?? '').trim(), // SiteID_A
          getValue('lrd_a') || getValue('lrd') || String(row[8] ?? '').trim(), // LRD_A
          getValue('siteid_b') || String(row[9] ?? '').trim(), // SiteID_B
          getValue('lrd_b') || String(row[10] ?? '').trim(), // LRD_B
          getValue('uplink') || String(row[11] ?? '').trim(), // Uplink
          getValue('linkcount') || getValue('link') || String(row[12] ?? '').trim(), // LinkCount
          getValue('protection') || String(row[13] ?? '').trim(), // Protection
          getValue('remoteip') || getValue('remote') || String(row[14] ?? '').trim(), // RemoteIP
          getValue('remoteslot') || getValue('slot') || String(row[15] ?? '').trim(), // RemoteSlot
          getValue('l3port') || getValue('l3 port') || String(row[16] ?? '').trim(), // L3PORT
          getValue('ras') || String(row[17] ?? '').trim(), // RAS
          getValue('hostname') || String(row[18] ?? '').trim(), // Hostname
          getValue('link') || String(row[19] ?? '').trim(), // link
          getValue('qam') || String(row[20] ?? '').trim(), // QAM
          sourceFileId
        );
        processedCount++;
        
        // Log first few successful rows
        if (processedCount <= 3) {
          console.log(`Successfully processed row ${processedCount}:`, {
            node: getValue('node'),
            ne_ip: getValue('ne ip') || getValue('ne_ip'),
            capacity: getValue('capacity')
          });
        }
      } catch (error) {
        errorCount++;
        console.error(`Error inserting row ${processedCount + errorCount}:`, error);
        if (errorCount <= 3) {
          console.error('Problematic row:', row);
        }
      }
    }

    console.log(`Final result - Processed: ${processedCount}, Errors: ${errorCount}`);

    // Update capacity summary
    updateCapacitySummary(db);

    db.close();

    return NextResponse.json({ 
      success: true, 
      message: `Imported ${processedCount} network routes successfully (${errorCount} errors)`,
      recordsProcessed: processedCount,
      errors: errorCount
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to process file: ' + (error as Error).message },
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