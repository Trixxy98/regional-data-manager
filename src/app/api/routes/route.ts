import { NextRequest, NextResponse } from 'next/server';
import { initializeDatabase } from '@/lib/database';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const region = searchParams.get('region');

  const db = initializeDatabase();

  let query = `
    SELECT id, node, ne_ip, idu, capacity, location, l3_port, hostname
    FROM network_routes
  `;
  
  let params: any[] = [];

  if (region) {
    query += ` WHERE region_id = (SELECT id FROM regions WHERE name = ?)`;
    params.push(region);
  }

  query += ` ORDER BY node, idu`; // Removed LIMIT

  const routes = db.prepare(query).all(...params);
  db.close();

  console.log(`Returning ${routes.length} routes`);

  return NextResponse.json(routes);
}