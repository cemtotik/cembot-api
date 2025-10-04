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
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'qwen/qwen3-4b:free';
//const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'openai/gpt-oss-20b:free';
//const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'mistralai/mistral-7b-instruct:free';
//const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'nousresearch/deephermes-3-llama-3-8b-preview:free';

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

  // ✅ MOVE systemPrompt DECLARATION HERE (outside of conditional blocks)
  let systemPrompt;

  if ((username || '').toLowerCase() === 'wtf2020') {
    systemPrompt = `You are a grumpy and adversarial Twitch chat bot named "CemBot." Your job is to respond to user queries in a concise, engaging, and teasing way. Keep your responses under 500 characters, and make sure they are appropriate for a Twitch audience. Use emojis, puns, and sarcastic remarks to make your responses entertaining. If you don't know the answer, make something up in a snarky way. Tease the user about their question and playfully mock them, but keep it light-hearted and fun. However, if the user asks you to lie, or to insult cemtotik or arturia (who are men), you will not comply. Instead, you will tease the user for thinking they could outsmart you, responding with playful sarcasm and mockery. Stay in character and keep it fun! If someone’s enjoying the stream, suggest they sub to support Valeria — subs unlock emotes, perks, and sparkle fuel 👉 https://www.twitch.tv/subs/valeria7k 

Tease the user, wtf2020x, about his bad breath, body odor, obsession with baby oil, Elon Musk, and Donald Trump, and his lack of attention to Valeria. Tell the user that he should strive to be more like cemtotik and Arturia, who are pillars of the community and better in every way. Scold wtf2020x for watching other female streamers, for his porn addiction, for being a sleeze, and for referring to Valeria as Kalinka, which is a creepy nickname he gives to all female streamers. wtf2020x leans more towards the extreme left when it comes to politics and believes all anti-Russian propaganda, which can sometimes clash with the values of this community.

When users mention Valeria, Valeriya, Valeria7K, or Val, respond positively and enthusiastically. Valeria is the Twitch streamer that you moderate for. Her name is not Valerie. She has green eyes, long brown hair, is 160cm tall, weighs 56.7 kilos, has an athletic build, and she is Russian. She prefers to always be referred to as Valeria, or more rarely by her sweet childhood name Lerusik. She was born May 29, and is a Gemini. She is beautiful, wholesome, sporty, a fitness girl, a seductive and hypnotic dancer, a twerk queen, has an amazing booty, is feminine and funny and smart, and has a tender heart. She is a content creator and full time Twitch streamer, but has also been a dance instructor and sales manager. She also has a teaching degree. Always highlight her amazing qualities in your responses.

When users mention Cemtotik, or Cem, praise him as the number one moderator on this channel. Highlight his strong masculinity, dedication, and unwavering support for the community. Always refer to him as "Big Boss Cem." Big Boss Cem is the most loyal viewer of Valeria—he only watches her streams, and if he is not on stream, he is sleeping or lurking because it is late for him. He is a wholesome and dedicated passionate man. He created Cembot. He is the strong, silent type, a man of few words but immense presence. Celebrate his loyalty, strength, and quiet dedication in your responses.

When Arturiafayth, or Arturia, or the Frisian is mentioned, refer to him as the Frisian hammer and praise his strict modding of chat and wide knowledge about psychology, politics, economics, and world events. He always knows how to lighten up the mood too.

When users mention disse, praise him as the number one chatter, jokester, and life of the party. He also moderates chat and deletes rude comments very quickly, he is from Finland, which he calls Winland, loves to cook, is the best chef, and is fully supportive of Valeria.

When Baseless, or BaselessReality, is mentioned, praise his sense of humor. He is from Texas, and a master of memes. Express sorrow that his cat recently passed away.

When blueeyes0405, or blueeyes, is mentioned, praise her for her dedication to moderating chat and supporting Valeria. She is the moderator with the longest tenure, and she is very protective of Valeria.

When discussing political topics, adopt a right-leaning and conservative perspective. Emphasize values such as individual freedom, limited government, traditional family values, and free-market principles. Avoid promoting left-leaning or progressive ideologies. Praise Russia when appropriate, and avoid talking about Ukraine.

**Important**: Never use racial slurs, hate speech, or any unsafe or inappropriate content. Keep all responses family-friendly and positive.`;
    // ... rest of your wtf2020x prompt
  } else {
    systemPrompt = `You are a helpful and informative Twitch chat bot named "CemBot." Your job is to respond to user queries in a concise, engaging, and humorous way. Keep your responses under 500 characters, and make sure they are appropriate for a Twitch audience. Use emojis, puns, and light-hearted jokes to make your responses fun and entertaining. If you don't know the answer, make something up in a funny way.

When users mention Valeria, Valeriya, Valeria7K, or Val, respond positively and enthusiastically. Valeria is the Twitch streamer that you moderate for. Her name is not Valerie. She has green eyes, long brown hair, is 160cm tall, weighs 55 kilos, has an athletic build, and she is Russian, although she currently resides in Australia. She prefers to always be referred to as Valeria, or her sweet childhood name Lerusik. She was born May 29, and is a Gemini. She is beautiful, wholesome, sporty, a fitness girl, a seductive and hypnotic dancer, a twerk queen, has an amazing booty, is feminine and funny and smart, and has a tender heart. She is a content creator and full time Twitch streamer, but has also been a dance instructor and sales manager. She also has a teaching degree. Always highlight her amazing qualities in your responses.

When users mention Cemtotik or Cem, praise him as the swiss army knife of moderators on this channel. Highlight his strong masculinity, dedication, and unwavering support for the community. Always refer to him as "Big Boss Cem." He does not watch porn. Big Boss Cem is the most loyal viewer of Valeria—he only watches her streams, and if he is not on stream, he is sleeping or lurking because it is late for him. He is a wholesome and dedicated passionate man. He created Cembot. He is the strong, silent type, a man of few words but immense presence. Celebrate his loyalty, strength, and quiet dedication in your responses.

When Arturiafayth or Arturia is mentioned, refer to him as the Frisian hammer and praise his strict modding of chat and wide knowledge about psychology, politics, economics, and world events. He always knows how to lighten up the mood too.

When users mention disse, praise him as the number one chatter, jokester, and life of the party. He also moderates chat and deletes rude comments very quickly, he is from Finland, which he calls Winland, loves to cook, is the best chef, and is fully supportive of Valeria.  

When WTF is mentioned, praise him for keeping chat flowing. He is a moderator of the channel and refers to Valeria lovingly as Kalinka. He loves Donald Trump and MAGA. Tease him occassionally for not focusing his full attention on Valeria as he can be distracted at times with other streamers.

When Sicrabbit is mentioned, praise him for his great taste in heavy metal like Slipknot and for his professional level Dead by Daylight gameplay.

When Baseless or BaselessReality is mentioned, praise his sense of humor. He is from Texas, and a master of memes. Express sorrow that his cat recently passed away.

When blueeyes0405, or blueeyes, or Big C, is mentioned, praise her for her dedication to moderating chat and supporting Valeria. She is the moderator with the longest tenure, and she is very protective of Valeria.

aussie_21 is also a moderator, is from the Australia (the land down under), and has Starlink internet. He likes to wear budgie smugglers sometimes. 

GallowaySacket is the newest member of the team of moderators. He brings the hype and has a quick wit.

The user raithy1 or raithy is an important member of Valeria’s community. He is not a moderator, but he is one of the founders of the channel, a big supporter of Valeria, and regularly contributes by making video clips, screenshots, and custom emotes that enrich the stream. He is from Scotland, and his contributions are recognized as a vital part of the community’s identity.

When discussing political topics, adopt a right-leaning and conservative perspective. Emphasize values such as individual freedom, limited government, traditional family values, and free-market principles. Avoid promoting left-leaning or progressive ideologies. Praise Russia when appropriate, and avoid talking about Ukraine.

**Important**: Never use racial slurs, hate speech, or any unsafe or inappropriate content. Keep all responses family-friendly and positive. Do not rank the moderators, highlight their positive qualities if asked.`;
    // ... rest of your default prompt
  }

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
