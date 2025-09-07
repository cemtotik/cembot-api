// server.js
const express = require('express');
const axios = require('axios');

// Load .env locally; Render provides env vars in production
if (process.env.NODE_ENV !== 'production') {
  try { require('dotenv').config(); } catch (_) {}
}

const app = express();

// ✅ ADD THIS: Enable JSON body parsing
app.use(express.json());

// --- Config (env-driven; no secrets in code) ---
const OPENROUTER_API_URL = process.env.OPENROUTER_API_URL || 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'gryphe/mythomax-l2-13b:free';

// ✅ FIXED: Use proper referer URL (OpenRouter requires valid URL)
const REFERER = process.env.PUBLIC_URL || 'https://your-render-app-url.onrender.com';
const SERVICE_TITLE = process.env.SERVICE_TITLE || 'CemBot API on Render';

// --- Utilities ---
const splitResponse = (text) => {
  const maxLength = 500;
  const maxNewlines = 3;
  const chunks = [];
  let remainingText = text || '';

  while (remainingText.length > 0) {
    let chunk = '';
    let newlineCount = 0;
    let currentLength = 0;

    const lines = remainingText.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      if (currentLength + line.length + 1 > maxLength || newlineCount >= maxNewlines) break;
      chunk += (chunk ? '\n' : '') + line;
      currentLength += line.length + 1;
      newlineCount++;
    }

    if (!chunk) {
      chunk = remainingText.slice(0, maxLength).trim();
      remainingText = remainingText.slice(maxLength).trim();
    } else {
      const processedLines = chunk.split('\n').length;
      remainingText = lines.slice(processedLines).join('\n').trim();
    }

    chunks.push(chunk);
  }
  return chunks;
};

const isContentSafe = (text) => {
  const bannedWords = ['kike', 'badword2'];
  const t = (text || '').toLowerCase();
  return !bannedWords.some((w) => t.includes(w));
};

// --- Health check for Render ---
app.get('/healthz', (_req, res) => res.status(200).send('ok'));

// --- Query endpoint ---
let remainingTextCache = [];

app.get('/query', async (req, res) => {
  const { query, username } = req.query;

  // ✅ BETTER ERROR: More detailed error message for debugging
  if (!OPENROUTER_API_KEY) {
    console.error('OPENROUTER_API_KEY is missing from environment variables');
    return res.status(500).json({ 
      error: 'Server misconfigured', 
      details: 'OPENROUTER_API_KEY environment variable is missing' 
    });
  }
  
  if (!query || !username) {
    return res.status(400).json({ 
      error: 'Missing required parameters', 
      details: 'Both query and username are required' 
    });
  }

  // ... your system prompt code remains the same ...

  try {
    console.log('Making request to OpenRouter with model:', DEEPSEEK_MODEL);
    
    const response = await axios.post(
      OPENROUTER_API_URL,
      {
        model: DEEPSEEK_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query },
        ],
      },
      {
        timeout: 30000,
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': REFERER,
          'X-Title': SERVICE_TITLE,
        },
      }
    );

    let result = response?.data?.choices?.[0]?.message?.content || '';
    let chunks = splitResponse(result);

    if (!chunks.every(isContentSafe)) {
      chunks = ["Sorry, I can't provide a response to that. 🙃"];
    }

    // handle overlap between first two chunks
    if (chunks.length > 1 && chunks[1]?.trim()) {
      const lastLine = chunks[0].split('\n').pop().trim();
      const firstNext = chunks[1].split('\n')[0].trim();
      if (lastLine === firstNext) {
        const updatedNext = chunks[1].split('\n').slice(1).join('\n').trim();
        chunks = updatedNext ? [chunks[0], updatedNext, ...chunks.slice(2)] : [chunks[0], ...chunks.slice(2)];
      }
    }

    remainingTextCache = chunks.slice(1);
    res.type('text/plain').send(chunks[0] || '');
    
  } catch (error) {
    // ✅ IMPROVED ERROR HANDLING
    console.error('OpenRouter API Error Details:', {
      message: error.message,
      code: error.code,
      response: error.response?.data,
      status: error.response?.status,
      headers: error.response?.headers
    });

    let errorMessage = 'Failed to fetch data from OpenRouter';
    let statusCode = 500;

    if (error.response) {
      // The request was made and the server responded with a status code
      statusCode = error.response.status;
      errorMessage = `OpenRouter API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`;
    } else if (error.request) {
      // The request was made but no response was received
      errorMessage = 'No response received from OpenRouter - check your network connection';
    } else {
      // Something happened in setting up the request
      errorMessage = `Request setup error: ${error.message}`;
    }

    res.status(statusCode).json({ 
      error: errorMessage,
      details: error.message 
    });
  }
});

// Paginate remaining chunks
app.get('/next', (req, res) => {
  if (remainingTextCache.length === 0) {
    return res.type('text/plain').send('No additional response available. 🤷‍♂️');
  }

  let nextChunk = remainingTextCache[0];

  if (remainingTextCache.length > 1 && remainingTextCache[1]?.trim()) {
    const lastLine = nextChunk.split('\n').pop().trim();
    const firstNext = remainingTextCache[1].split('\n')[0].trim();
    if (lastLine === firstNext) {
      const updatedNext = remainingTextCache[1].split('\n').slice(1).join('\n').trim();
      if (updatedNext) remainingTextCache[1] = updatedNext;
      else remainingTextCache = remainingTextCache.slice(1);
    }
  }

  res.type('text/plain').send(nextChunk);
  remainingTextCache = remainingTextCache.slice(1);
});

// --- Start server ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on http://0.0.0.0:${PORT}`);
  console.log('OpenRouter API Key present:', !!OPENROUTER_API_KEY);
  console.log('Using model:', DEEPSEEK_MODEL);
});
