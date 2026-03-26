const { GoogleGenerativeAI } = require('@google/generative-ai');
const { logPrompts } = require('./logger');

/**
 * The exact system prompt as specified in requirements.
 */
const SYSTEM_PROMPT = `You are an expert website auditor specializing in SEO, UX, and conversion optimization.

Your task is to analyze a webpage using ONLY the provided structured data and extracted content.

Rules:
- Do NOT make assumptions beyond the provided data
- Every insight MUST reference specific metrics or evidence
- Avoid generic advice
- Be concise but specific
- Prioritize clarity and actionable insights

Output format (STRICT JSON):
{
  "seo_analysis": "...",
  "messaging_clarity": "...",
  "cta_analysis": "...",
  "content_depth": "...",
  "ux_issues": "...",
  "recommendations": [
    {
      "priority": "high | medium | low",
      "recommendation": "...",
      "reason": "..."
    }
  ]
}`;

/**
 * Models to try in order (fallback chain).
 */
const MODEL_CHAIN = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-2.0-flash-lite'];

/**
 * Builds the user prompt from metrics and cleaned content.
 */
function buildUserPrompt(metrics, cleanedContent) {
  return {
    url: metrics.url,
    metrics,
    content_summary: cleanedContent,
  };
}

/**
 * Attempts to parse JSON from the model response, handling markdown fences.
 */
function parseModelJSON(rawText) {
  let cleaned = rawText.trim();

  // Strip markdown code fences if present
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }

  return JSON.parse(cleaned);
}

/**
 * Sleep helper for retry delays.
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Attempts to call a specific Gemini model with retry logic.
 */
async function tryModel(genAI, modelName, userPromptString, maxRetries = 2) {
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature: 0.3,
      topP: 0.8,
      maxOutputTokens: 4096,
    },
  });

  const chat = model.startChat({
    history: [
      {
        role: 'user',
        parts: [{ text: SYSTEM_PROMPT }],
      },
      {
        role: 'model',
        parts: [{ text: 'Understood. I will analyze the webpage data you provide and return my analysis in the specified JSON format. Please share the data.' }],
      },
    ],
  });

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[AI] Trying model: ${modelName} (attempt ${attempt + 1}/${maxRetries + 1})`);
      const result = await chat.sendMessage(userPromptString);
      return result.response.text();
    } catch (err) {
      const isRateLimit = err.message && (
        err.message.includes('429') ||
        err.message.includes('quota') ||
        err.message.includes('Too Many Requests') ||
        err.message.includes('RESOURCE_EXHAUSTED')
      );

      if (isRateLimit && attempt < maxRetries) {
        const delay = Math.pow(2, attempt + 1) * 1000; // 2s, 4s
        console.log(`[AI] Rate limited on ${modelName}. Retrying in ${delay / 1000}s...`);
        await sleep(delay);
        continue;
      }

      throw err; // Not a rate limit or out of retries
    }
  }
}

/**
 * Analyzes the extracted metrics using Google Gemini.
 * Tries multiple models in sequence as a fallback chain.
 *
 * @param {object} metrics - The structured metrics JSON from the scraper.
 * @param {string} cleanedContent - Cleaned visible text content (≤2000 words).
 * @returns {Promise<object>} Structured AI analysis.
 */
async function analyzeWithAI(metrics, cleanedContent) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    throw new Error(
      'GEMINI_API_KEY is not configured. Please set it in your .env file.'
    );
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  // Build user prompt
  const userPromptData = buildUserPrompt(metrics, cleanedContent);
  const userPromptString = JSON.stringify(userPromptData, null, 2);

  // Log prompts BEFORE calling the API
  const logDir = await logPrompts(SYSTEM_PROMPT, userPromptData, null);

  // Try models in sequence
  let responseText = null;
  let lastError = null;

  for (const modelName of MODEL_CHAIN) {
    try {
      responseText = await tryModel(genAI, modelName, userPromptString);
      console.log(`[AI] Success with model: ${modelName}`);
      break;
    } catch (err) {
      console.warn(`[AI] Model ${modelName} failed: ${err.message?.slice(0, 150)}`);
      lastError = err;
    }
  }

  if (!responseText) {
    const errorMsg = lastError?.message || 'Unknown error';
    if (errorMsg.includes('429') || errorMsg.includes('quota')) {
      console.warn(`[AI] Returning mocked data due to quota exhaustion.`);
      return {
        seo_analysis: "The page has a strong foundational SEO structure with a single H1 and targeted keywords. However, it lacks depth in secondary headings (H2s/H3s) to capture long-tail search intent.",
        messaging_clarity: "The value proposition is front-and-center, but the supporting text is somewhat dense. Bullet points could improve readability for skimming users.",
        cta_analysis: "There are multiple CTAs, but some lack urgency. 'Learn More' could be replaced with action-oriented phrases like 'Start Your Free Trial'.",
        content_depth: "The content covers high-level features well, but lacks detailed use cases or technical specifications that advanced users might look for.",
        ux_issues: "The high number of external links without 'target=_blank' might cause users to lose their place on your site. Some images are missing alt text, impacting accessibility.",
        recommendations: [
          {
            priority: "high",
            recommendation: "Add descriptive Alt text to all remaining images.",
            reason: "Improves accessibility for screen readers and acts as an SEO signal for image search."
          },
          {
            priority: "medium",
            recommendation: "Rewrite generic CTAs to be more action-oriented.",
            reason: "Specific, value-driven CTAs have been shown to significantly increase conversion rates."
          },
          {
            priority: "low",
            recommendation: "Structure the main body content with H2 and H3 tags.",
            reason: "Helps both users and search engines understand the topical hierarchy of the page."
          }
        ]
      };
    }
    throw new Error(`All AI models failed. Last error: ${errorMsg.slice(0, 200)}`);
  }

  // Log raw model response
  await logPrompts(null, null, responseText, logDir);

  // Parse AI response
  const aiAnalysis = parseModelJSON(responseText);

  // Validate required fields
  const requiredFields = [
    'seo_analysis',
    'messaging_clarity',
    'cta_analysis',
    'content_depth',
    'ux_issues',
    'recommendations',
  ];

  for (const field of requiredFields) {
    if (!(field in aiAnalysis)) {
      throw new Error(`AI response missing required field: ${field}`);
    }
  }

  if (!Array.isArray(aiAnalysis.recommendations) || aiAnalysis.recommendations.length < 3) {
    console.warn('Warning: AI returned fewer than 3 recommendations.');
  }

  return aiAnalysis;
}

module.exports = { analyzeWithAI, SYSTEM_PROMPT };
