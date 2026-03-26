/**
 * Frontend application logic for the Website Audit Tool.
 * Handles form submission, API calls, and rendering of all three result sections.
 */

// ── DOM Elements ─────────────────────────────────────────────────
const auditForm = document.getElementById('audit-form');
const urlInput = document.getElementById('url-input');
const submitBtn = document.getElementById('submit-btn');
const inputSection = document.getElementById('input-section');
const loadingSection = document.getElementById('loading-section');
const errorSection = document.getElementById('error-section');
const resultsSection = document.getElementById('results-section');
const errorMessage = document.getElementById('error-message');
const retryBtn = document.getElementById('retry-btn');
const newAuditBtn = document.getElementById('new-audit-btn');

// Loading step elements
const stepFetch = document.getElementById('step-fetch');
const stepExtract = document.getElementById('step-extract');
const stepAI = document.getElementById('step-ai');

// ── Insight Icons & Labels ───────────────────────────────────────
const INSIGHT_CONFIG = {
  seo_analysis: { icon: '🔍', label: 'SEO Structure' },
  messaging_clarity: { icon: '💬', label: 'Messaging Clarity' },
  cta_analysis: { icon: '🎯', label: 'CTA Usage' },
  content_depth: { icon: '📚', label: 'Content Depth' },
  ux_issues: { icon: '⚡', label: 'UX Issues' },
};

// ── State Management ─────────────────────────────────────────────
let isLoading = false;

// ── Event Listeners ──────────────────────────────────────────────
auditForm.addEventListener('submit', handleAudit);
retryBtn.addEventListener('click', resetToInput);
newAuditBtn.addEventListener('click', resetToInput);

/**
 * Handle the audit form submission.
 */
async function handleAudit(e) {
  e.preventDefault();
  if (isLoading) return;

  const url = urlInput.value.trim();
  if (!url) return;

  isLoading = true;
  showLoading();

  try {
    // Animate loading steps with delays
    updateLoadingStep(1);

    const response = await fetch('/api/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });

    updateLoadingStep(2);

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Audit failed');
    }

    updateLoadingStep(3);

    // Small delay for visual polish
    await sleep(600);

    renderResults(data);
    showResults();
  } catch (error) {
    showError(error.message);
  } finally {
    isLoading = false;
  }
}

// ── View Management ──────────────────────────────────────────────
function showLoading() {
  inputSection.querySelector('.hint').classList.add('hidden');
  submitBtn.classList.add('loading');
  submitBtn.disabled = true;
  errorSection.classList.add('hidden');
  resultsSection.classList.add('hidden');
  loadingSection.classList.remove('hidden');
  resetLoadingSteps();
}

function showResults() {
  loadingSection.classList.add('hidden');
  inputSection.querySelector('.hint').classList.remove('hidden');
  submitBtn.classList.remove('loading');
  submitBtn.disabled = false;
  resultsSection.classList.remove('hidden');

  // Scroll to results
  resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function showError(message) {
  loadingSection.classList.add('hidden');
  inputSection.querySelector('.hint').classList.remove('hidden');
  submitBtn.classList.remove('loading');
  submitBtn.disabled = false;
  errorMessage.textContent = message;
  errorSection.classList.remove('hidden');
}

function resetToInput() {
  errorSection.classList.add('hidden');
  resultsSection.classList.add('hidden');
  loadingSection.classList.add('hidden');
  inputSection.querySelector('.hint').classList.remove('hidden');
  submitBtn.classList.remove('loading');
  submitBtn.disabled = false;
  urlInput.value = '';
  urlInput.focus();
}

// ── Loading Steps Animation ──────────────────────────────────────
function resetLoadingSteps() {
  [stepFetch, stepExtract, stepAI].forEach(s => {
    s.classList.remove('active', 'done');
  });
  stepFetch.classList.add('active');
}

function updateLoadingStep(step) {
  if (step >= 2) {
    stepFetch.classList.remove('active');
    stepFetch.classList.add('done');
    stepExtract.classList.add('active');
  }
  if (step >= 3) {
    stepExtract.classList.remove('active');
    stepExtract.classList.add('done');
    stepAI.classList.add('active');
  }
}

// ── Render Results ───────────────────────────────────────────────

/**
 * Main render function — populates all three result sections.
 */
function renderResults(data) {
  renderMetrics(data.metrics);
  renderInsights(data.aiAnalysis);
  renderRecommendations(data.aiAnalysis.recommendations);
}

/**
 * SECTION 1: Factual Metrics
 */
function renderMetrics(metrics) {
  const grid = document.getElementById('metrics-grid');
  const meta = document.getElementById('meta-info');

  // Metric cards
  const cards = [
    { value: metrics.word_count.toLocaleString(), label: 'Total Words', color: 'cyan' },
    { value: metrics.headings.h1, label: 'H1 Headings', color: 'indigo' },
    { value: metrics.headings.h2, label: 'H2 Headings', color: 'indigo' },
    { value: metrics.headings.h3, label: 'H3 Headings', color: 'indigo' },
    { value: metrics.cta_count, label: 'CTA Elements', color: 'amber' },
    { value: metrics.internal_links, label: 'Internal Links', color: 'emerald' },
    { value: metrics.external_links, label: 'External Links', color: 'emerald' },
    { value: metrics.images.total, label: 'Total Images', color: 'violet' },
    { value: metrics.images.missing_alt, label: 'Missing Alt Text', color: 'rose' },
    { value: `${metrics.images.missing_alt_percentage}%`, label: 'Missing Alt %', color: 'rose' },
  ];

  grid.innerHTML = cards.map(card => `
    <div class="metric-card">
      <div class="metric-value ${card.color}">${card.value}</div>
      <div class="metric-label">${card.label}</div>
    </div>
  `).join('');

  // Meta info
  const title = metrics.meta.title;
  const desc = metrics.meta.description;

  meta.innerHTML = `
    <div class="meta-item">
      <div class="meta-item-label">Meta Title</div>
      <div class="meta-item-value ${!title ? 'empty' : ''}">${title || 'Not found'}</div>
    </div>
    <div class="meta-item">
      <div class="meta-item-label">Meta Description</div>
      <div class="meta-item-value ${!desc ? 'empty' : ''}">${desc || 'Not found'}</div>
    </div>
    <div class="meta-item">
      <div class="meta-item-label">Audited URL</div>
      <div class="meta-item-value"><a href="${escapeHtml(metrics.url)}" target="_blank" rel="noopener" style="color: var(--accent-1); text-decoration: none;">${escapeHtml(metrics.url)}</a></div>
    </div>
  `;
}

/**
 * SECTION 2: AI Insights
 */
function renderInsights(analysis) {
  const grid = document.getElementById('insights-grid');

  const insightKeys = ['seo_analysis', 'messaging_clarity', 'cta_analysis', 'content_depth', 'ux_issues'];

  grid.innerHTML = insightKeys.map(key => {
    const config = INSIGHT_CONFIG[key];
    const content = analysis[key] || 'No analysis available.';

    return `
      <div class="insight-card">
        <div class="insight-title">
          <span>${config.icon}</span>
          <span>${config.label}</span>
        </div>
        <div class="insight-content">${escapeHtml(content)}</div>
      </div>
    `;
  }).join('');
}

/**
 * SECTION 3: Recommendations
 */
function renderRecommendations(recommendations) {
  const list = document.getElementById('recommendations-list');

  if (!recommendations || recommendations.length === 0) {
    list.innerHTML = '<p style="color: var(--text-muted); text-align: center;">No recommendations generated.</p>';
    return;
  }

  // Sort: high → medium → low
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  const sorted = [...recommendations].sort(
    (a, b) => (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3)
  );

  list.innerHTML = sorted.map((rec, index) => {
    const priority = (rec.priority || 'medium').toLowerCase();

    return `
      <div class="reco-card">
        <div class="reco-number ${priority}">${index + 1}</div>
        <div class="reco-body">
          <span class="reco-priority ${priority}">${priority} priority</span>
          <div class="reco-text">${escapeHtml(rec.recommendation)}</div>
          <div class="reco-reason">${escapeHtml(rec.reason)}</div>
        </div>
      </div>
    `;
  }).join('');
}

// ── Utilities ────────────────────────────────────────────────────
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
