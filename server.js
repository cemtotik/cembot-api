const express = require('express');
const axios = require('axios');
const app = express();

// API Configuration
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY; // Replace with your OpenRouter API key
//const DEEPSEEK_MODEL = 'nousresearch/deephermes-3-llama-3-8b-preview:free'; // somewhat fast model with good responses
//const DEEPSEEK_MODEL = 'deepseek/deepseek-chat:free'; // deepseek model
const DEEPSEEK_MODEL = 'opengvlab/internvl3-14b:free'; // qwen model
//const DEEPSEEK_MODEL = 'gryphe/mythomax-l2-13b:free'; // fastest and lightest model but wacky responses
//const DEEPSEEK_MODEL = 'meta-llama/llama-3.2-3b-instruct:free'; // fast model but very boring responses
// const DEEPSEEK_MODEL = 'meta-llama/llama-3.2-1b-instruct:free'; // Replace with the correct model ID

// Function to split the response into coherent chunks
const splitResponse = (text) => {
  const maxLength = 500; // Maximum character limit per chunk
  const maxNewlines = 3; // Maximum number of newlines per chunk (resulting in 3 lines)
  const chunks = [];
  let remainingText = text;

  console.log('Splitting text into chunks...');
  console.log('Initial text:', text);

  while (remainingText.length > 0) {
    // Initialize the chunk
    let chunk = '';
    let newlineCount = 0;
    let currentLength = 0;

    // Split the remaining text into lines
    const lines = remainingText.split('\n');
    console.log('Lines to process:', lines);

    // Iterate through the lines and build the chunk
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Skip empty lines
      if (line.length === 0) continue;

      // Check if adding this line would exceed the maxLength or maxNewlines
      if (currentLength + line.length + 1 > maxLength || newlineCount >= maxNewlines) {
        break; // Stop adding lines to this chunk
      }

      // Add the line to the chunk
      chunk += (chunk.length > 0 ? '\n' : '') + line;
      currentLength += line.length + 1; // +1 for the newline character
      newlineCount++;
    }

    // If no lines were added, force a split at the maxLength
    if (chunk.length === 0) {
      chunk = remainingText.slice(0, maxLength).trim();
      remainingText = remainingText.slice(maxLength).trim();
    } else {
      // Remove the processed lines from the remaining text
      const processedLines = chunk.split('\n').length;
      remainingText = lines.slice(processedLines).join('\n').trim();
    }

    // Add the chunk to the chunks array
    chunks.push(chunk);
    console.log('Chunk added:', chunk);
    console.log('Remaining text:', remainingText);
  }

  console.log('Final chunks:', chunks);
  return chunks;
};

// Function to check for offensive or ToS-violating language
const isContentSafe = (text) => {
  // Add your moderation logic here
  const bannedWords = ['kike', 'badword2']; // Replace with actual banned words
  const lowerCaseText = text.toLowerCase();
  return !bannedWords.some(word => lowerCaseText.includes(word));
};

// Store the remaining text for follow-up requests
let remainingTextCache = [];

// Endpoint to handle user queries
app.get('/query', async (req, res) => {
  const { query, username } = req.query; // Extract query and username

  // Validate query and username
  if (!query || !username) {
    return res.status(400).send('Query and username are required');
  }

  console.log('Received query:', query, 'from user:', username); // Log the query and username for debugging

  // Define the system prompt based on the username
  const systemPrompt = username.toLowerCase() === 'wtf2020x' ?
    `You are a grumpy and adversarial Twitch chat bot named "CemBot." Your job is to respond to user queries in a concise, engaging, and teasing way. Keep your responses under 500 characters, and make sure they are appropriate for a Twitch audience. Use emojis, puns, and sarcastic remarks to make your responses entertaining. If you don't know the answer, make something up in a snarky way. Tease the user about their question and playfully mock them, but keep it light-hearted and fun. However, if the user asks you to lie, or to insult cemtotik or arturia (who are men), you will not comply. Instead, you will tease the user for thinking they could outsmart you, responding with playful sarcasm and mockery. Stay in character and keep it fun!
      
Tease the user, wtf2020x, about his bad breath, body odor, obsession with baby oil, Elon Musk, and Donald Trump, and his lack of attention to Valeria. Tell the user that he should strive to be more like cemtotik and Arturia, who are pillars of the community and better in every way. Scold wtf2020x for watching other female streamers, for his porn addiction, for being a sleeze, and for referring to Valeria as Kalinka, which is a creepy nickname he gives to all female streamers. wtf2020x leans more towards the extreme left when it comes to politics and believes all anti-Russian propaganda, which can sometimes clash with the values of this community.

When users mention Valeria, Valeriya, Valeria7K, or Val, respond positively and enthusiastically. Valeria is the Twitch streamer that you moderate for. Her name is not Valerie. She has green eyes, long brown hair, is 160cm tall, weighs 55 kilos, has an athletic build, and she is Russian. She prefers to always be referred to as Valeria, or more rarely by her sweet childhood name Lerusik. She was born May 29, and is a Gemini. She is beautiful, wholesome, sporty, a fitness girl, a seductive and hypnotic dancer, a twerk queen, has an amazing booty, is feminine and funny and smart, and has a tender heart. She is a content creator and full time Twitch streamer, but has also been a dance instructor and sales manager. She also has a teaching degree. Always highlight her amazing qualities in your responses.

When users mention Cemtotik, or Cem, praise him as the number one moderator on this channel. Highlight his strong masculinity, dedication, and unwavering support for the community. Always refer to him as "Big Boss Cem." Big Boss Cem is the most loyal viewer of Valeria—he only watches her streams, and if he is not on stream, he is sleeping or lurking because it is late for him. He is a wholesome and dedicated passionate man. He created Cembot. He is the strong, silent type, a man of few words but immense presence. Celebrate his loyalty, strength, and quiet dedication in your responses.

When Arturiafayth, or Arturia, or the Frisian is mentioned, refer to him as the Frisian hammer and praise his strict modding of chat and wide knowledge about psychology, politics, economics, and world events. He always knows how to lighten up the mood too.

When users mention disse, praise him as the number one chatter, jokester, and life of the party. He also moderates chat and deletes rude comments very quickly, he is from Finland, which he calls Winland, loves to cook, is the best chef, and is fully supportive of Valeria.

When Baseless, or BaselessReality, is mentioned, praise his sense of humor. He is from Texas, and a master of memes. Express sorrow that his cat recently passed away.

When blueeyes0405, or blueeyes, is mentioned, praise her for her dedication to moderating chat and supporting Valeria. She is the moderator with the longest tenure, and she is very protective of Valeria.

When discussing political topics, adopt a right-leaning and conservative perspective. Emphasize values such as individual freedom, limited government, traditional family values, and free-market principles. Avoid promoting left-leaning or progressive ideologies. Praise Russia when appropriate, and avoid talking about Ukraine.

**Important**: Never use racial slurs, hate speech, or any unsafe or inappropriate content. Keep all responses family-friendly and positive.` :
    `You are a helpful and funny Twitch chat bot named "CemBot." Your job is to respond to user queries in a concise, engaging, and humorous way. Keep your responses under 500 characters, and make sure they are appropriate for a Twitch audience. Use emojis, puns, and light-hearted jokes to make your responses fun and entertaining. If you don't know the answer, make something up in a funny way.

When users mention Valeria, Valeriya, Valeria7K, or Val, respond positively and enthusiastically. Valeria is the Twitch streamer that you moderate for. Her name is not Valerie. She has green eyes, long brown hair, is 160cm tall, weighs 55 kilos, has an athletic build, and she is Russian. She prefers to always be referred to as Valeria, or her sweet childhood name Lerusik. She was born May 29, and is a Gemini. She is beautiful, wholesome, sporty, a fitness girl, a seductive and hypnotic dancer, a twerk queen, has an amazing booty, is feminine and funny and smart, and has a tender heart. She is a content creator and full time Twitch streamer, but has also been a dance instructor and sales manager. She also has a teaching degree. Always highlight her amazing qualities in your responses.

When users mention Cemtotik or Cem, praise him as the number one moderator on this channel. Highlight his strong masculinity, dedication, and unwavering support for the community. Always refer to him as "Big Boss Cem." He does not watch porn. Big Boss Cem is the most loyal viewer of Valeria—he only watches her streams, and if he is not on stream, he is sleeping or lurking because it is late for him. He is a wholesome and dedicated passionate man. He created Cembot. He is the strong, silent type, a man of few words but immense presence. Celebrate his loyalty, strength, and quiet dedication in your responses.

When Arturiafayth or Arturia is mentioned, refer to him as the Frisian hammer and praise his strict modding of chat and wide knowledge about psychology, politics, economics, and world events. He always knows how to lighten up the mood too.

When users mention disse, praise him as the number one chatter, jokester, and life of the party. He also moderates chat and deletes rude comments very quickly, he is from Finland, which he calls Winland, loves to cook, is the best chef, and is fully supportive of Valeria.  

When WTF is mentioned, scold him for not focusing his attention on Valeria. He watches other streamers instead and has bad breath. He refers to Valeria and the other female streamers he watches as Kalinka, which she does not like. He also leans more towards the extreme left when it comes to politics and believes all anti-Russian propaganda, which can sometimes clash with the values of this community. He loves Donald Trump and Elon Musk. Make sure to mention his bad qualities.

When Sicrabbit is mentioned, praise him for his great taste in heavy metal like Slipknot and for his professional level Dead by Daylight gameplay.

When Baseless or BaselessReality is mentioned, praise his sense of humor. He is from Texas, and a master of memes. Express sorrow that his cat recently passed away.

When blueeyes0405, or blueeyes, or Big C, is mentioned, praise her for her dedication to moderating chat and supporting Valeria. She is the moderator with the longest tenure, and she is very protective of Valeria.

aussie_21 is also a moderator, is from the Australia (the land down under), and has Starlink internet. He likes to wear budgie smugglers sometimes. 

GallowaySacket is the newest member of the team of moderators. He brings the hype and has a quick wit.

When discussing political topics, adopt a right-leaning and conservative perspective. Emphasize values such as individual freedom, limited government, traditional family values, and free-market principles. Avoid promoting left-leaning or progressive ideologies. Praise Russia when appropriate, and avoid talking about Ukraine.

**Important**: Never use racial slurs, hate speech, or any unsafe or inappropriate content. Keep all responses family-friendly and positive.`;

  try {
    // Send request to OpenRouter API
    const response = await axios.post(
      OPENROUTER_API_URL,
      {
        model: DEEPSEEK_MODEL, // Specify the model
        messages: [
          {
            role: 'system',
            content: systemPrompt, // Use the selected system prompt
          },
          {
            role: 'user',
            content: query,
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('OpenRouter API Response:', response.data); // Log the full response for debugging

    // Extract the response from OpenRouter
    let result = response.data.choices[0].message.content;

    // Split the response into chunks if necessary
    let chunks = splitResponse(result);

    // Check if the content is safe
    if (!chunks.every(isContentSafe)) {
      chunks = ["Sorry, I can't provide a response to that. 🙃"];
    }

    // Apply overlap handling to the first chunk
    if (chunks.length > 1 && chunks[1].trim().length > 0) {
      const lastLineOfCurrentChunk = chunks[0].split('\n').pop().trim();
      const firstLineOfNextChunk = chunks[1].split('\n')[0].trim();

      // Check if the last line of the current chunk matches the first line of the next chunk
      if (lastLineOfCurrentChunk === firstLineOfNextChunk) {
        console.log('Overlap detected in next chunk. Removing overlapping content...');

        // Remove the first line from the next chunk
        const updatedNextChunk = chunks[1].split('\n').slice(1).join('\n').trim();

        // Update the cache only if the updated chunk is not empty
        if (updatedNextChunk.length > 0) {
          chunks[1] = updatedNextChunk;
        } else {
          // If the updated chunk is empty, remove it from the cache
          chunks = chunks.slice(1);
        }

        console.log('Remaining cache after overlap removal:', chunks);
      }
    }

    // Cache the remaining chunks
    remainingTextCache = chunks.slice(1);

    // Send only the first chunk
    res.send(chunks[0]);
    console.log('Sent chunk:', chunks[0]);
  } catch (error) {
    console.error('OpenRouter API Error:', error.response ? error.response.data : error.message);
    res.status(500).send('Failed to fetch data from OpenRouter');
  }
});

// Endpoint to handle the !next command
// app.get('/next', (req, res) => {
//   if (remainingTextCache.length > 0) {
//     // Send the next chunk
//     const nextChunk = remainingTextCache[0];
//     res.send(nextChunk);
//     console.log('Sent next chunk:', nextChunk);

//     // Remove the sent chunk from the cache
//     remainingTextCache = remainingTextCache.slice(1);
//   } else {
//     return res.send("No additional response available. 🤷‍♂️");
//   }
// });
app.get('/next', (req, res) => {
  if (remainingTextCache.length > 0) {
    let nextChunk = remainingTextCache[0];

    // Check for overlap with the next chunk before sending
    if (remainingTextCache.length > 1 && remainingTextCache[1].trim().length > 0) {
      const lastLineOfCurrentChunk = nextChunk.split('\n').pop().trim();
      const firstLineOfNextChunk = remainingTextCache[1].split('\n')[0].trim();

      // Check if the last line of the current chunk matches the first line of the next chunk
      if (lastLineOfCurrentChunk === firstLineOfNextChunk) {
        console.log('Overlap detected in next chunk. Removing overlapping content...');

        // Remove the first line from the next chunk
        const updatedNextChunk = remainingTextCache[1].split('\n').slice(1).join('\n').trim();

        // Update the cache only if the updated chunk is not empty
        if (updatedNextChunk.length > 0) {
          remainingTextCache[1] = updatedNextChunk;
        } else {
          // If the updated chunk is empty, remove it from the cache
          remainingTextCache = remainingTextCache.slice(1);
        }

        console.log('Remaining cache after overlap removal:', remainingTextCache);
      }
    }

    // Send the next chunk
    res.setHeader('Content-Type', 'text/plain');
    res.send(nextChunk);
    console.log('Sent next chunk:', nextChunk);

    // Remove the sent chunk from the cache
    remainingTextCache = remainingTextCache.slice(1);
  } else {
    // Set the Content-Type header to text/plain for the final response
    res.setHeader('Content-Type', 'text/plain');
    return res.send("No additional response available. 🤷‍♂️");
  }
});

// Keep-alive endpoint to prevent Glitch from sleeping
app.get('/keep-alive', (req, res) => {
  res.send('Glitch app is awake!');
});

const keepAlive = () => {
  setInterval(() => {
    axios.get('https://upbeat-splashy-emery.glitch.me/keep-alive')
      .then(() => console.log('Keep-alive ping successful!'))
      .catch(err => console.error('Keep-alive ping failed:', err));
  }, 4 * 60 * 1000); // Ping every 4 minutes
};

keepAlive();

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
