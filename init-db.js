const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./shakas.db');

db.serialize(() => {
  // Create shakas table
  db.run(`
    CREATE TABLE IF NOT EXISTS shakas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      location_name TEXT,
      user_agent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT valid_lat CHECK (latitude >= -90 AND latitude <= 90),
      CONSTRAINT valid_lng CHECK (longitude >= -180 AND longitude <= 180)
    )
  `);
  
  // Create index for better query performance
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_created_at ON shakas(created_at)
  `);
  
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_coordinates ON shakas(latitude, longitude)
  `);
  
  // Add some initial shakas for Hunter
  const initialShakas = [
    { lat: 21.3099, lng: -157.8581, name: "Honolulu, Hawaii" },
    { lat: 36.7783, lng: -119.4179, name: "California, USA" },
    { lat: -33.8688, lng: 151.2093, name: "Sydney, Australia" }
  ];
  
  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO shakas (latitude, longitude, location_name, user_agent, created_at)
    VALUES (?, ?, ?, ?, datetime('now', '-' || ? || ' hours'))
  `);
  
  initialShakas.forEach((shaka, index) => {
    insertStmt.run(shaka.lat, shaka.lng, shaka.name, 'Initial Data', (index + 1) * 24);
  });
  
  insertStmt.finalize();
});

db.close((err) => {
  if (err) {
    console.error('Error closing database:', err.message);
  } else {
    console.log('✅ Database initialized successfully!');
    console.log('🤙 Ready to track shakas around the world!');
  }
});
