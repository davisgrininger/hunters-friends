
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

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

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      // Get all shakas
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
      
      return res.json(shakas);

    } else if (req.method === 'POST') {
      // Add a new shaka
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
      
      console.log(`🤙 New shaka added: ${newShaka.locationName} (${latitude}, ${longitude})`);
      return res.status(201).json(newShaka);

    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
