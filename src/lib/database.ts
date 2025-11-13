import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'data', 'regional_data.db');

export function initializeDatabase() {
  const db = new Database(dbPath);
  
  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS regions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      target_range TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS source_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      region_id INTEGER,
      FOREIGN KEY (region_id) REFERENCES regions (id)
    );

    CREATE TABLE IF NOT EXISTS network_routes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      region_id INTEGER,
      node TEXT,
      ne_ip TEXT,
      idu TEXT,
      capacity TEXT,
      location TEXT,
      parallel TEXT,
      main_stby TEXT,
      site_id_a TEXT,
      lrd_a TEXT,
      site_id_b TEXT,
      lrd_b TEXT,
      uplink TEXT,
      link_count TEXT,
      protection TEXT,
      remote_ip TEXT,
      remote_slot TEXT,
      l3_port TEXT,
      ras TEXT,
      hostname TEXT,
      link TEXT,
      qam TEXT,
      source_file_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (region_id) REFERENCES regions (id),
      FOREIGN KEY (source_file_id) REFERENCES source_files (id)
    );

    CREATE TABLE IF NOT EXISTS capacity_summary (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      capacity_type TEXT NOT NULL,
      central_count INTEGER DEFAULT 0,
      northern_count INTEGER DEFAULT 0,
      eastern_count INTEGER DEFAULT 0,
      southern_count INTEGER DEFAULT 0,
      em_count INTEGER DEFAULT 0,
      grand_total INTEGER DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Insert initial regions
  const insertRegion = db.prepare(`
    INSERT OR IGNORE INTO regions (name, target_range) 
    VALUES (?, ?)
  `);

  const regions = [
    ['Central', 'B3'],
    ['Northern', 'B4'], 
    ['Eastern', 'B5'],
    ['Southern', 'B6'],
    ['EM', 'B7']
  ];

  regions.forEach(region => insertRegion.run(region));

  return db;
}