const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Database connection
const db = new sqlite3.Database('./shakas.db', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('🗄️  Connected to SQLite database');
  }
});

// Socket.io connection
io.on('connection', (socket) => {
  console.log('🤙 User connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('👋 User disconnected:', socket.id);
  });
});

// API Routes

// Get all shakas
app.get('/api/shakas', (req, res) => {
  const query = `
    SELECT id, latitude, longitude, location_name, created_at, user_agent
    FROM shakas 
    ORDER BY created_at DESC
  `;
  
  db.all(query, [], (err, rows) => {
    if (err) {
      console.error('Error fetching shakas:', err);
      return res.status(500).json({ error: 'Failed to fetch shakas' });
    }
    
    const shakas = rows.map(row => ({
      id: row.id,
      lat: row.latitude,
      lng: row.longitude,
      locationName: row.location_name,
      timestamp: new Date(row.created_at).getTime(),
      userAgent: row.user_agent
    }));
    
    res.json(shakas);
  });
});

// Add a new shaka
app.post('/api/shakas', (req, res) => {
  const { latitude, longitude, locationName } = req.body;
  const userAgent = req.headers['user-agent'] || 'Unknown';
  
  // Validation
  if (!latitude || !longitude) {
    return res.status(400).json({ error: 'Latitude and longitude are required' });
  }
  
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return res.status(400).json({ error: 'Invalid coordinates' });
  }
  
  const query = `
    INSERT INTO shakas (latitude, longitude, location_name, user_agent, created_at)
    VALUES (?, ?, ?, ?, datetime('now'))
  `;
  
  db.run(query, [latitude, longitude, locationName || 'Unknown Location', userAgent], function(err) {
    if (err) {
      console.error('Error inserting shaka:', err);
      return res.status(500).json({ error: 'Failed to save shaka' });
    }
    
    const newShaka = {
      id: this.lastID,
      lat: latitude,
      lng: longitude,
      locationName: locationName || 'Unknown Location',
      timestamp: Date.now(),
      userAgent: userAgent
    };
    
    // Broadcast to all connected clients
    io.emit('new-shaka', newShaka);
    
    console.log(`🤙 New shaka added: ${locationName} (${latitude}, ${longitude})`);
    res.status(201).json(newShaka);
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...');
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err.message);
    } else {
      console.log('🗄️  Database connection closed');
    }
    server.close(() => {
      console.log('👋 Server closed');
      process.exit(0);
    });
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🤙 Hunter's Friends is ready to receive shakas!`);
});
