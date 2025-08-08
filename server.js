require('dotenv').config();
console.log("🐛 DEBUG - USE_POSTGRES:", process.env.USE_POSTGRES, "NODE_ENV:", process.env.NODE_ENV);
const express = require('express');
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

// Database setup - choose between SQLite (dev) or Supabase (production)
let db;
let supabase;
const usePostgreSQL = process.env.NODE_ENV === 'production' || process.env.USE_POSTGRES === 'true';
console.log("🐛 DEBUG - usePostgreSQL:", usePostgreSQL, "typeof USE_POSTGRES:", typeof process.env.USE_POSTGRES);

if (usePostgreSQL) {
  // Supabase client setup
  const { createClient } = require('@supabase/supabase-js');
  supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );
  console.log('🚀 Using Supabase client');
} else {
  // SQLite setup (for local development)
  const sqlite3 = require('sqlite3').verbose();
  db = new sqlite3.Database('./shakas.db', (err) => {
    if (err) {
      console.error('Error opening SQLite database:', err.message);
    } else {
      console.log('🗄️  Using SQLite database');
    }
  });
}

// Socket.io connection
io.on('connection', (socket) => {
  console.log('🤙 User connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('👋 User disconnected:', socket.id);
  });
});

// API Routes

// Get all shakas
app.get('/api/shakas', async (req, res) => {
  try {
    if (usePostgreSQL) {
      // Supabase query
      const { data, error } = await supabase
        .from('shakas')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Supabase error:', error);
        return res.status(500).json({ error: 'Failed to fetch shakas' });
      }
      
      const shakas = data.map(row => ({
        id: row.id,
        lat: row.latitude,
        lng: row.longitude,
        locationName: row.location_name,
        message: row.message,
        timestamp: new Date(row.created_at).getTime(),
        userAgent: row.user_agent
      }));
      
      res.json(shakas);
    } else {
      // SQLite query
      const query = `
        SELECT id, latitude, longitude, location_name, message, created_at, user_agent
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
          message: row.message,
          timestamp: new Date(row.created_at).getTime(),
          userAgent: row.user_agent
        }));
        
        res.json(shakas);
      });
    }
  } catch (error) {
    console.error('Error fetching shakas:', error);
    res.status(500).json({ error: 'Failed to fetch shakas' });
  }
});

// Add a new shaka
app.post('/api/shakas', async (req, res) => {
  const { latitude, longitude, locationName, message } = req.body;
  const userAgent = req.headers['user-agent'] || 'Unknown';
  
  // Validation
  if (!latitude || !longitude) {
    return res.status(400).json({ error: 'Latitude and longitude are required' });
  }
  
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return res.status(400).json({ error: 'Invalid coordinates' });
  }

  // Filter message for inappropriate content
  const filteredMessage = message ? filterInappropriateContent(message.trim()) : null;
  
  try {
    if (usePostgreSQL) {
      // Supabase insert
      const { data, error } = await supabase
        .from('shakas')
        .insert([
          {
            latitude: latitude,
            longitude: longitude,
            location_name: locationName || 'Unknown Location',
            message: filteredMessage,
            user_agent: userAgent,
            created_at: new Date().toISOString()
          }
        ])
        .select()
        .single();
      
      if (error) {
        console.error('Supabase insert error:', error);
        return res.status(500).json({ error: 'Failed to save shaka' });
      }
      
      const newShaka = {
        id: data.id,
        lat: data.latitude,
        lng: data.longitude,
        locationName: data.location_name,
        message: data.message,
        timestamp: new Date(data.created_at).getTime(),
        userAgent: data.user_agent
      };
      
      // Broadcast to all connected clients
      io.emit('new-shaka', newShaka);
      
      console.log(`🤙 New shaka added: ${newShaka.locationName} (${latitude}, ${longitude})`);
      res.status(201).json(newShaka);
    } else {
      // SQLite insert
      const query = `
        INSERT INTO shakas (latitude, longitude, location_name, message, user_agent, created_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'))
      `;
      
      db.run(query, [latitude, longitude, locationName || 'Unknown Location', filteredMessage, userAgent], function(err) {
        if (err) {
          console.error('Error inserting shaka:', err);
          return res.status(500).json({ error: 'Failed to save shaka' });
        }
        
        const newShaka = {
          id: this.lastID,
          lat: latitude,
          lng: longitude,
          locationName: locationName || 'Unknown Location',
          message: filteredMessage,
          timestamp: Date.now(),
          userAgent: userAgent
        };
        
        // Broadcast to all connected clients
        io.emit('new-shaka', newShaka);
        
        console.log(`🤙 New shaka added: ${locationName} (${latitude}, ${longitude})`);
        res.status(201).json(newShaka);
      });
    }
  } catch (error) {
    console.error('Error inserting shaka:', error);
    res.status(500).json({ error: 'Failed to save shaka' });
  }
});

// Content filter function for kid-friendly messages
function filterInappropriateContent(text) {
  if (!text) return text;
  
  const inappropriateWords = [
    'stupid', 'dumb', 'hate', 'shut up', 'shutup', 'idiot', 'loser', 'sucks',
    'damn', 'hell', 'crap', 'poop', 'fart', 'butt', 'pee', 'gross', 'ugly',
    'kill', 'die', 'dead', 'hurt', 'pain', 'bad', 'worst', 'terrible', 'awful'
  ];
  
  let filteredText = text;
  inappropriateWords.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    filteredText = filteredText.replace(regex, '❤️');
  });
  
  return filteredText.slice(0, 50); // Ensure max 50 characters
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    database: usePostgreSQL ? 'Supabase' : 'SQLite',
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
  
  if (usePostgreSQL) {
    console.log('🚀 Supabase client connection closed');
    server.close(() => {
      console.log('👋 Server closed');
      process.exit(0);
    });
  } else {
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err.message);
      } else {
        console.log('🗄️  SQLite database connection closed');
      }
      server.close(() => {
        console.log('👋 Server closed');
        process.exit(0);
      });
    });
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🤙 Hunter's Friends is ready to receive shakas!`);
  console.log(`📊 Database: ${usePostgreSQL ? 'Supabase' : 'SQLite (Local)'}`);
});