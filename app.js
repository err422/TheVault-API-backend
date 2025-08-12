const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all origins
app.use(cors());
app.use(express.json());

// In-memory storage (will reset when server restarts, but works reliably)
let counts = {};

// Helper functions
function getCount(key) {
  return counts[key] || 0;
}

function setCount(key, value) {
  counts[key] = value;
  return counts[key];
}

function incrementCount(key) {
  counts[key] = (counts[key] || 0) + 1;
  return counts[key];
}

function resetCount(key) {
  counts[key] = 0;
  return counts[key];
}

// API Routes

// Get count for a specific key
app.get('/api/count/:key', (req, res) => {
  try {
    const { key } = req.params;
    const value = getCount(key);
    
    res.json({
      key: key,
      value: value
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get count' });
  }
});

// Increment count for a specific key
app.post('/api/count/:key/increment', (req, res) => {
  try {
    const { key } = req.params;
    const value = incrementCount(key);
    
    res.json({
      key: key,
      value: value
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to increment count' });
  }
});

// Set a specific count value
app.put('/api/count/:key', (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    
    if (typeof value !== 'number') {
      return res.status(400).json({ error: 'Value must be a number' });
    }
    
    const newValue = setCount(key, value);
    
    res.json({
      key: key,
      value: newValue
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to set count' });
  }
});

// Reset count for a specific key
app.delete('/api/count/:key', (req, res) => {
  try {
    const { key } = req.params;
    const value = resetCount(key);
    
    res.json({
      key: key,
      value: value
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reset count' });
  }
});

// Get all counts
app.get('/api/counts', (req, res) => {
  try {
    res.json(counts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get counts' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Count API Server', 
    endpoints: {
      'GET /api/count/:key': 'Get count for key',
      'POST /api/count/:key/increment': 'Increment count for key',
      'PUT /api/count/:key': 'Set count for key',
      'DELETE /api/count/:key': 'Reset count for key',
      'GET /api/counts': 'Get all counts'
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Count API server running on port ${PORT}`);
});
