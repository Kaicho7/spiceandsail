/**
 * LLM integration — optional Gemini or OpenAI-compatible free-tier.
 * Falls back gracefully if no API key, rate limited, or timeout.
 * NEVER sends contact details, phone numbers, or email to the model.
 */
'use strict';

const TIMEOUT_MS = 8000;

/** Strip PII from user text before sending to any model */
function stripPII(text) {
  if (!text) return '';
  return text
    .replace(/\+?\d[\d\s\-().]{5,15}\d/g, '[phone]')  // phone numbers
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, '[email]')  // emails
    // Only redact names explicitly introduced by the guest. A blanket
    // "Capitalised Word Capitalised Word" rule also destroys place names
    // such as "Stone Town" and "Nungwi Beach". Keep the name part
    // case-sensitive; only the introducer is case-insensitive.
    .replace(/(\b(?:[Mm]y name is|[Ii] am|[Ii]'m|[Nn]ame\s*[:\-]))\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}/g, '$1 [name]');
}

/** Call Gemini API */
async function callGemini(systemPrompt, userMessage, toolResults) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent';

  const contents = [
    { role: 'user', parts: [{ text: systemPrompt }] },
    { role: 'model', parts: [{ text: 'Understood. I will follow the concierge rules.' }] },
  ];

  if (toolResults && toolResults.length > 0) {
    contents.push({ role: 'user', parts: [{ text: '[TOOL_RESULTS]\n' + JSON.stringify(toolResults) }] });
  }

  contents.push({ role: 'user', parts: [{ text: stripPII(userMessage) }] });

  const body = JSON.stringify({
    contents: contents,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 800,
      responseMimeType: 'application/json',
    },
  });

  const controller = new AbortController();
  const timer = setTimeout(function () { controller.abort(); }, TIMEOUT_MS);

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: body,
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!resp.ok) {
      const status = resp.status;
      if (status === 401 || status === 402 || status === 429) return null;
      return null;
    }

    const data = await resp.json();
    const text = data.candidates && data.candidates[0] && data.candidates[0].content &&
      data.candidates[0].content.parts && data.candidates[0].content.parts[0] &&
      data.candidates[0].content.parts[0].text;
    return text || null;
  } catch (e) {
    clearTimeout(timer);
    return null; // timeout or network error
  }
}

/** Call OpenAI-compatible endpoint (Groq, OpenRouter free models) */
async function callOpenAICompat(systemPrompt, userMessage, toolResults) {
  const baseUrl = process.env.OPENAI_COMPAT_BASE_URL;
  const apiKey = process.env.OPENAI_COMPAT_API_KEY;
  if (!baseUrl || !apiKey) return null;

  const messages = [
    { role: 'system', content: systemPrompt },
  ];

  if (toolResults && toolResults.length > 0) {
    messages.push({ role: 'assistant', content: JSON.stringify({ action: 'tool_results', data: toolResults }) });
  }

  messages.push({ role: 'user', content: stripPII(userMessage) });

  const controller = new AbortController();
  const timer = setTimeout(function () { controller.abort(); }, TIMEOUT_MS);

  try {
    const resp = await fetch(baseUrl + '/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
      },
      body: JSON.stringify({
        messages: messages,
        temperature: 0.7,
        max_tokens: 800,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!resp.ok) return null;
    const data = await resp.json();
    return data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content || null;
  } catch (e) {
    clearTimeout(timer);
    return null;
  }
}

/**
 * Try LLM providers in order. Returns parsed JSON or null.
 * On any failure, returns null (caller falls back to deterministic).
 */
async function tryLLM(systemPrompt, userMessage, toolResults) {
  // Try Gemini first
  let raw = await callGemini(systemPrompt, userMessage, toolResults);
  if (!raw) {
    // Try OpenAI-compatible as fallback
    raw = await callOpenAICompat(systemPrompt, userMessage, toolResults);
  }
  if (!raw) return null;

  // Parse JSON response
  try {
    // Strip markdown fences
    let cleaned = raw.trim();
    cleaned = cleaned.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
    const start = cleaned.indexOf('{');
    if (start === -1) return null;
    let depth = 0;
    let inStr = false;
    let esc = false;
    let end = -1;
    for (let i = start; i < cleaned.length; i++) {
      const c = cleaned[i];
      if (inStr) {
        if (esc) esc = false;
        else if (c === '\\') esc = true;
        else if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') inStr = true;
      else if (c === '{') depth++;
      else if (c === '}') { depth--; if (depth === 0) { end = i; break; } }
    }
    if (end <= start) return null;
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch (e) {
    return null;
  }
}

module.exports = { tryLLM, stripPII, callGemini, callOpenAICompat };
