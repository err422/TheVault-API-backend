const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// Environment variables - Set these in Render dashboard
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// Validate required environment variables
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Missing required environment variables: SUPABASE_URL and SUPABASE_SERVICE_KEY');
    process.exit(1);
}

// Initialize Supabase client with service role key
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Middleware
app.use(helmet()); // Security headers
app.use(express.json({ limit: '10mb' })); // Parse JSON bodies

// CORS configuration - Allow requests from CodeHS
app.use(cors({
    origin: [
        'https://codehs.com',
        'https://*.codehs.com',
        'https://sandbox.codehs.com',
        'http://localhost:*', // For local testing
    ],
    credentials: true
}));

// Rate limiting to prevent abuse
const clickRateLimit = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 30, // Limit each IP to 30 requests per windowMs
    message: {
        error: 'Too many clicks from this IP, please try again later.'
    }
});

const leaderboardRateLimit = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 60, // Limit each IP to 60 requests per windowMs
    message: {
        error: 'Too many requests from this IP, please try again later.'
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        service: 'card-click-tracker'
    });
});

// Log a card click
app.post('/log-click', clickRateLimit, async (req, res) => {
    try {
        const { cardTitle } = req.body;

        // Validate input
        if (!cardTitle || typeof cardTitle !== 'string' || cardTitle.trim().length === 0) {
            return res.status(400).json({
                error: 'Missing or invalid cardTitle. Must be a non-empty string.'
            });
        }

        // Sanitize card title (basic security)
        const sanitizedTitle = cardTitle.trim().substring(0, 255);

        // Get client info for spam prevention
        const userIP = req.ip || req.connection.remoteAddress || 'unknown';
        const userAgent = req.get('User-Agent') || 'unknown';

        // Insert click record into Supabase
        const { data, error } = await supabase
            .from('click_tracking')
            .insert([
                {
                    card_title: sanitizedTitle,
                    user_ip: userIP,
                    user_agent: userAgent
                }
            ])
            .select();

        if (error) {
            console.error('Supabase error:', error);
            return res.status(500).json({
                error: 'Failed to log click'
            });
        }

        console.log(`Click logged: "${sanitizedTitle}" from ${userIP}`);
        
        res.json({
            success: true,
            message: 'Click logged successfully',
            data: data[0]
        });

    } catch (error) {
        console.error('Error logging click:', error);
        res.status(500).json({
            error: 'Internal server error'
        });
    }
});

// Get leaderboard of most-clicked cards
app.get('/leaderboard', leaderboardRateLimit, async (req, res) => {
    try {
        // Get optional query parameters
        const limit = Math.min(parseInt(req.query.limit) || 10, 100); // Max 100 results
        const minClicks = parseInt(req.query.minClicks) || 1;

        // Query the leaderboard
        const { data, error } = await supabase
            .from('click_leaderboard')
            .select('*')
            .gte('click_count', minClicks)
            .limit(limit);

        if (error) {
            console.error('Supabase error:', error);
            return res.status(500).json({
                error: 'Failed to fetch leaderboard'
            });
        }

        res.json({
            success: true,
            leaderboard: data,
            metadata: {
                total_entries: data.length,
                limit_applied: limit,
                min_clicks_filter: minClicks,
                generated_at: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        res.status(500).json({
            error: 'Internal server error'
        });
    }
});

// Get analytics for a specific card
app.get('/analytics/:cardTitle', leaderboardRateLimit, async (req, res) => {
    try {
        const cardTitle = decodeURIComponent(req.params.cardTitle);
        
        // Get click count and recent activity for specific card
        const { data, error } = await supabase
            .from('click_tracking')
            .select('clicked_at')
            .eq('card_title', cardTitle)
            .order('clicked_at', { ascending: false });

        if (error) {
            console.error('Supabase error:', error);
            return res.status(500).json({
                error: 'Failed to fetch analytics'
            });
        }

        const totalClicks = data.length;
        const recentClicks = data.slice(0, 10); // Last 10 clicks
        
        res.json({
            success: true,
            card_title: cardTitle,
            total_clicks: totalClicks,
            recent_clicks: recentClicks,
            first_click: data[data.length - 1]?.clicked_at || null,
            last_click: data[0]?.clicked_at || null
        });

    } catch (error) {
        console.error('Error fetching analytics:', error);
        res.status(500).json({
            error: 'Internal server error'
        });
    }
});

// Handle 404s
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Endpoint not found'
    });
});

// Global error handler
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({
        error: 'Internal server error'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Card click tracker running on port ${PORT}`);
    console.log(`📊 Endpoints available:`);
    console.log(`   GET  /health - Health check`);
    console.log(`   POST /log-click - Log a card click`);
    console.log(`   GET  /leaderboard - Get most popular cards`);
    console.log(`   GET  /analytics/:cardTitle - Get analytics for specific card`);
});

module.exports = app;
