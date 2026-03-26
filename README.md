# 🔍 WebAuditAI — AI-Powered Website Audit Tool

A lightweight, web-based tool that extracts factual website metrics deterministically and generates structured AI insights using Google Gemini.

![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)
![License](https://img.shields.io/badge/License-MIT-blue)

---

## 📐 Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                  Browser (Frontend)                  │
│   URL Input → API Request → Render 3 Sections       │
└────────────────────┬────────────────────────────────┘
                     │ POST /api/audit
                     ▼
┌─────────────────────────────────────────────────────┐
│                Express Server (server.js)             │
│   Orchestrates: Scrape → Analyze → Respond           │
└────────┬────────────────┬────────────────┬──────────┘
         │                │                │
         ▼                ▼                ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  Scraper     │ │  AI Analyzer │ │  Logger      │
│  (cheerio)   │ │  (Gemini)    │ │  (filesystem)│
│  NO AI       │ │  Strict      │ │  Prompt logs │
│  Deterministic│ │  Prompt      │ │  Raw output  │
└──────────────┘ └──────────────┘ └──────────────┘
```

**Strict separation**:
- **Scraper Layer**: Pure DOM parsing with `cheerio`. Zero AI involvement. All metrics are deterministic.
- **AI Layer**: Receives structured JSON + cleaned text only. Never sees raw HTML.
- **Logger**: Stores system prompt, user prompt, and raw model response for every audit.

---

## 🧠 AI Design Decisions

### Why Structured Input?
The AI receives a pre-processed JSON payload containing metrics and cleaned text (~2000 words max). This ensures:
1. **Consistency** — AI always gets the same data format
2. **Cost efficiency** — No wasted tokens on HTML tags
3. **Safety** — No risk of prompt injection via raw HTML

### Prompt Engineering
- **System prompt** defines the AI's role as a website auditor and enforces strict JSON output
- **User prompt** is dynamically built from extracted metrics + cleaned content
- **Temperature 0.3** ensures consistent, focused analysis
- **Chat format** with priming message ensures the model stays in auditor mode

### Why Gemini?
- Excellent JSON output compliance
- Cost-effective for structured analysis tasks
- Good at referencing specific data points

---

## 📊 What Gets Extracted (No AI)

| Metric | Method |
|--------|--------|
| Word count | Visible text after stripping scripts/styles/hidden elements |
| H1/H2/H3 counts | Direct DOM query |
| CTA count | `<button>` elements + `<a>` tags matching CTA keywords |
| Internal links | Domain comparison via `URL` API |
| External links | Domain comparison via `URL` API |
| Image count | Direct DOM query |
| Missing alt % | Images without `alt` attribute or empty `alt` |
| Meta title | `<title>` element |
| Meta description | `<meta name="description">` or OG fallback |

---

## 🚀 Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Configure API key
```bash
cp .env.example .env
# Edit .env and add your Google Gemini API key
```

### 3. Start the server
```bash
npm start
```

### 4. Open in browser
Navigate to `http://localhost:3000`

---

## 📁 Project Structure

```
├── server.js              # Express server & API endpoint
├── src/
│   ├── scraper.js         # Deterministic metrics extraction
│   ├── analyzer.js        # Gemini AI analysis
│   └── logger.js          # Prompt logging
├── public/
│   ├── index.html         # Frontend UI
│   ├── style.css          # Styling (dark theme)
│   └── app.js             # Frontend logic
├── logs/                  # Auto-generated prompt logs
│   └── audit_YYYY-MM-DD/
│       ├── system_prompt.txt
│       ├── user_prompt.json
│       └── raw_model_response.json
├── samples/
│   └── example_output.json
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

---

## ⚖️ Trade-offs & Limitations

| Decision | Trade-off |
|----------|-----------|
| **No JS rendering** | Sites relying on client-side rendering (SPAs) will have incomplete content. We fetch raw HTML only. |
| **Heuristic CTA detection** | CTA detection uses keyword matching, which may miss custom CTA text or flag false positives. |
| **Single-page only** | Tool audits one URL at a time. No site-wide crawling. |
| **~2000 word limit** | Content sent to AI is truncated to control costs and stay within context limits. |
| **No authentication** | Cannot audit pages behind login walls. |
| **Static HTML parsing** | Hidden elements are detected via inline styles only; CSS class-based hiding is not caught. |

---

## 🔮 Future Improvements

1. **Headless browser rendering** — Use Puppeteer/Playwright for JS-rendered content
2. **Lighthouse integration** — Add Core Web Vitals and performance scores
3. **Multi-page crawling** — Audit entire sites with sitemap support
4. **Competitor comparison** — Compare metrics across multiple URLs
5. **Historical tracking** — Store audit results in a database for trend analysis
6. **PDF export** — Generate downloadable audit reports
7. **Custom CTA keywords** — Allow users to define their own CTA keyword list
8. **Accessibility audit** — WCAG compliance checks
9. **Schema markup detection** — Identify structured data (JSON-LD, microdata)
10. **Rate limiting** — Protect against API abuse in production

---

## 📜 License

MIT
