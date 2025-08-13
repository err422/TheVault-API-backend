const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Middleware
app.use(cors());
app.use(express.json());

// Root endpoint
app.get('/', (req, res) => {
  res.json({ message: 'Visit Counter API is running!' });
});

// Get visit count for a specific page
app.get('/api/visits/:page?', async (req, res) => {
  try {
    const pageUrl = req.params.page || '/';
    
    const { data, error } = await supabase
      .from('visits')
      .select('visit_count')
      .eq('page_url', pageUrl)
      .single();

    if (error && error.code === 'PGRST116') {
      // Page doesn't exist, create it
      const { data: newData, error: insertError } = await supabase
        .from('visits')
        .insert({ page_url: pageUrl, visit_count: 0 })
        .select('visit_count')
        .single();

      if (insertError) {
        throw insertError;
      }

      return res.json({ page: pageUrl, visits: newData.visit_count });
    }

    if (error) {
      throw error;
    }

    res.json({ page: pageUrl, visits: data.visit_count });
  } catch (error) {
    console.error('Error fetching visits:', error);
    res.status(500).json({ error: 'Failed to fetch visit count' });
  }
});

// Increment visit count
app.post('/api/visits/:page?', async (req, res) => {
  try {
    const pageUrl = req.params.page || '/';
    
    // First, try to increment existing record
    const { data, error } = await supabase.rpc('increment_visits', {
      page_path: pageUrl
    });

    if (error) {
      // If RPC fails, try manual increment
      const { data: existingData, error: selectError } = await supabase
        .from('visits')
        .select('visit_count')
        .eq('page_url', pageUrl)
        .single();

      if (selectError && selectError.code === 'PGRST116') {
        // Page doesn't exist, create it with count 1
        const { data: newData, error: insertError } = await supabase
          .from('visits')
          .insert({ page_url: pageUrl, visit_count: 1 })
          .select('visit_count')
          .single();

        if (insertError) throw insertError;
        return res.json({ page: pageUrl, visits: newData.visit_count });
      }

      if (selectError) throw selectError;

      // Update existing record
      const { data: updateData, error: updateError } = await supabase
        .from('visits')
        .update({ 
          visit_count: existingData.visit_count + 1,
          last_visit: new Date().toISOString()
        })
        .eq('page_url', pageUrl)
        .select('visit_count')
        .single();

      if (updateError) throw updateError;
      return res.json({ page: pageUrl, visits: updateData.visit_count });
    }

    res.json({ page: pageUrl, visits: data });
  } catch (error) {
    console.error('Error incrementing visits:', error);
    res.status(500).json({ error: 'Failed to increment visit count' });
  }
});

// Get all page visits (optional analytics endpoint)
app.get('/api/visits', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('visits')
      .select('*')
      .order('visit_count', { ascending: false });

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Error fetching all visits:', error);
    res.status(500).json({ error: 'Failed to fetch visits data' });
  }
});

app.listen(PORT, () => {
  console.log(`Visit counter server running on port ${PORT}`);
});
