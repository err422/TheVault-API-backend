const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

// Connect to Supabase using service role key (keep it secret!)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Increment and return new count
app.post('/api/count/visitors/increment', async (req, res) => {
  const pageSlug = '/'; // Could also use req.query.slug if you want per-page counts

  // Increment count in Supabase
  const { error } = await supabase.rpc('increment_view_count', { page_slug: pageSlug });
  if (error) {
    console.error('Error incrementing count:', error.message);
    return res.status(500).json({ error: error.message });
  }

  // Fetch updated count
  const { data, error: fetchError } = await supabase
    .from('page_views')
    .select('views')
    .eq('slug', pageSlug)
    .single();

  if (fetchError) {
    console.error('Error fetching count:', fetchError.message);
    return res.status(500).json({ error: fetchError.message });
  }

  res.json({ value: data.views });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
