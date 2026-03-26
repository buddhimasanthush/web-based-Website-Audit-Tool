require('dotenv').config();
const express = require('express');
const path = require('path');
const { scrapeWebpage } = require('./src/scraper');
const { analyzeWithAI } = require('./src/analyzer');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── API Routes ───────────────────────────────────────────────────

/**
 * POST /api/audit
 * Accepts { url: string }
 * Returns { metrics, aiAnalysis }
 */
app.post('/api/audit', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required.' });
  }

  // Basic URL validation
  try {
    new URL(url);
  } catch {
    return res.status(400).json({ error: 'Invalid URL format. Please include the protocol (e.g., https://).' });
  }

  try {
    // Step 1: Scrape & extract metrics (deterministic, no AI)
    console.log(`[SCRAPER] Fetching and analyzing: ${url}`);
    const { metrics, cleanedContent } = await scrapeWebpage(url);
    console.log(`[SCRAPER] Metrics extracted successfully.`);

    // Step 2: AI Analysis
    console.log(`[AI] Sending metrics to Gemini for analysis...`);
    const aiAnalysis = await analyzeWithAI(metrics, cleanedContent);
    console.log(`[AI] Analysis complete.`);

    // Step 3: Return both sections
    return res.json({
      success: true,
      metrics,
      aiAnalysis,
    });
  } catch (error) {
    console.error(`[ERROR] Audit failed:`, error.message);

    // Determine user-friendly error
    let statusCode = 500;
    let errorMsg = 'An unexpected error occurred during the audit.';

    if (error.message.includes('GEMINI_API_KEY')) {
      statusCode = 503;
      errorMsg = error.message;
    } else if (error.message.includes('quota exceeded') || error.message.includes('429')) {
      statusCode = 429;
      errorMsg = error.message;
    } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      statusCode = 400;
      errorMsg = 'Could not reach the specified URL. Please check the address.';
    } else if (error.response && error.response.status) {
      statusCode = 400;
      errorMsg = `The target website returned status ${error.response.status}.`;
    } else if (error.message.includes('timeout')) {
      statusCode = 408;
      errorMsg = 'The request timed out. The target website may be too slow.';
    }

    return res.status(statusCode).json({ error: errorMsg });
  }
});

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasApiKey: !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here'),
  });
});

// ── Start Server ─────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🔍 Website Audit Tool running at http://localhost:${PORT}`);
  console.log(`   API Key configured: ${!!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here')}\n`);
});
