const axios = require('axios');
const cheerio = require('cheerio');
const https = require('https');
const { URL } = require('url');

/**
 * CTA keywords to detect call-to-action anchor tags.
 */
const CTA_KEYWORDS = [
  'contact', 'get started', 'book', 'try', 'buy', 'signup',
  'sign up', 'learn more', 'get in touch', 'subscribe',
  'register', 'download', 'free trial', 'request', 'schedule'
];

/**
 * Elements to strip before extracting visible text.
 */
const STRIP_TAGS = ['script', 'style', 'noscript', 'svg', 'iframe'];

/**
 * Extracts the domain (hostname) from a URL string.
 * Returns null on invalid URLs.
 */
function extractDomain(urlString) {
  try {
    const parsed = new URL(urlString);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/**
 * Resolves a potentially relative URL against a base.
 */
function resolveUrl(href, baseUrl) {
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return null;
  }
}

/**
 * Determines if a link is internal by comparing domains.
 */
function isInternalLink(href, baseDomain) {
  const linkDomain = extractDomain(href);
  if (!linkDomain) return true; // relative / malformed → treat as internal
  return linkDomain === baseDomain;
}

/**
 * Checks if anchor text contains any CTA keyword (case-insensitive).
 */
function isCTALink(anchorText) {
  const lower = anchorText.toLowerCase().trim();
  return CTA_KEYWORDS.some(keyword => lower.includes(keyword));
}

/**
 * Main scraper function.
 * Fetches URL, extracts all required metrics deterministically.
 * 
 * @param {string} url - The webpage URL to audit.
 * @returns {Promise<{metrics: object, cleanedContent: string}>}
 */
async function scrapeWebpage(url) {
  // ── 1. Fetch HTML ──────────────────────────────────────────────
  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    },
    timeout: 15000,
    maxRedirects: 5,
    httpsAgent: new https.Agent({ rejectUnauthorized: false }),
  });

  const html = response.data;
  const $ = cheerio.load(html);
  const baseDomain = extractDomain(url);

  // ── 2. Extract Meta Information ────────────────────────────────
  const metaTitle = $('title').first().text().trim() || '';
  const metaDescription =
    $('meta[name="description"]').attr('content')?.trim() ||
    $('meta[property="og:description"]').attr('content')?.trim() ||
    '';

  // ── 3. Strip non-visible elements ─────────────────────────────
  STRIP_TAGS.forEach(tag => $(tag).remove());

  // Remove hidden elements (inline style display:none or visibility:hidden)
  $('[style]').each((_, el) => {
    const style = $(el).attr('style') || '';
    if (/display\s*:\s*none/i.test(style) || /visibility\s*:\s*hidden/i.test(style)) {
      $(el).remove();
    }
  });

  // Remove elements with hidden attribute
  $('[hidden]').remove();
  $('[aria-hidden="true"]').remove();

  // ── 4. Heading Counts ─────────────────────────────────────────
  const headings = {
    h1: $('h1').length,
    h2: $('h2').length,
    h3: $('h3').length,
  };

  // ── 5. CTA Count ──────────────────────────────────────────────
  const buttonCount = $('button').length;

  let ctaLinkCount = 0;
  $('a').each((_, el) => {
    const text = $(el).text();
    if (isCTALink(text)) {
      ctaLinkCount++;
    }
  });

  const ctaCount = buttonCount + ctaLinkCount;

  // ── 6. Link Analysis ──────────────────────────────────────────
  let internalLinks = 0;
  let externalLinks = 0;

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href')?.trim();
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) {
      return; // Skip anchors, mailto, tel, javascript
    }

    const resolvedHref = resolveUrl(href, url);
    if (!resolvedHref) return;

    if (isInternalLink(resolvedHref, baseDomain)) {
      internalLinks++;
    } else {
      externalLinks++;
    }
  });

  // ── 7. Image Analysis ─────────────────────────────────────────
  const images = $('img');
  const totalImages = images.length;
  let missingAlt = 0;

  images.each((_, el) => {
    const alt = $(el).attr('alt');
    if (alt === undefined || alt === null || alt.trim() === '') {
      missingAlt++;
    }
  });

  const missingAltPercentage = totalImages > 0
    ? Math.round((missingAlt / totalImages) * 100 * 100) / 100
    : 0;

  // ── 8. Visible Text & Word Count ──────────────────────────────
  const bodyText = $('body').text();
  // Normalize whitespace
  const cleanedText = bodyText
    .replace(/\s+/g, ' ')
    .trim();

  const words = cleanedText.split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;

  // Truncated content for AI (max ~2000 words)
  const MAX_WORDS_FOR_AI = 2000;
  const truncatedContent = words.slice(0, MAX_WORDS_FOR_AI).join(' ');

  // ── 9. Build Metrics Object ───────────────────────────────────
  const metrics = {
    url,
    word_count: wordCount,
    headings,
    cta_count: ctaCount,
    internal_links: internalLinks,
    external_links: externalLinks,
    images: {
      total: totalImages,
      missing_alt: missingAlt,
      missing_alt_percentage: missingAltPercentage,
    },
    meta: {
      title: metaTitle,
      description: metaDescription,
    },
  };

  return {
    metrics,
    cleanedContent: truncatedContent,
  };
}

module.exports = { scrapeWebpage };
