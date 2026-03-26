const fs = require('fs').promises;
const path = require('path');

/**
 * Creates a timestamped log directory under /logs/.
 */
async function createLogDir() {
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .slice(0, 19);

  const logDir = path.join(process.cwd(), 'logs', `audit_${timestamp}`);
  await fs.mkdir(logDir, { recursive: true });
  return logDir;
}

/**
 * Logs prompts and model responses to the filesystem.
 *
 * Called in two phases:
 * 1. Before API call: logs system_prompt.txt and user_prompt.json (rawResponse = null)
 * 2. After API call: logs raw_model_response.json (systemPrompt and userPrompt = null)
 *
 * @param {string|null} systemPrompt - The system prompt text.
 * @param {object|null} userPrompt - The user prompt object.
 * @param {string|null} rawResponse - The raw model response text.
 * @param {string|null} existingLogDir - Reuse an existing log directory (for phase 2).
 * @returns {Promise<string>} The log directory path.
 */
async function logPrompts(systemPrompt, userPrompt, rawResponse, existingLogDir = null) {
  const logDir = existingLogDir || await createLogDir();

  // Phase 1: Log system prompt and user prompt
  if (systemPrompt !== null) {
    await fs.writeFile(
      path.join(logDir, 'system_prompt.txt'),
      systemPrompt,
      'utf-8'
    );
  }

  if (userPrompt !== null) {
    await fs.writeFile(
      path.join(logDir, 'user_prompt.json'),
      JSON.stringify(userPrompt, null, 2),
      'utf-8'
    );
  }

  // Phase 2: Log raw model response
  if (rawResponse !== null) {
    // Store the raw response — try to parse as JSON for pretty formatting
    let formattedResponse;
    try {
      let cleaned = rawResponse.trim();
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
      }
      const parsed = JSON.parse(cleaned);
      formattedResponse = JSON.stringify(parsed, null, 2);
    } catch {
      // If not valid JSON, store as-is
      formattedResponse = rawResponse;
    }

    await fs.writeFile(
      path.join(logDir, 'raw_model_response.json'),
      formattedResponse,
      'utf-8'
    );
  }

  return logDir;
}

module.exports = { logPrompts };
