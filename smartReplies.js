// ============================================================
// SMART REPLIES
// Deterministic responses for simple messages/questions.
// These do NOT use Ollama.
// ============================================================


// ------------------------------------------------------------
// Normalize text
// ------------------------------------------------------------

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}


// ------------------------------------------------------------
// Find a direct memory answer
// ------------------------------------------------------------

function getMemoryAnswer(userText, memory = []) {

  const text = normalize(userText);

  if (!Array.isArray(memory) || memory.length === 0) {
    return null;
  }


  // ==========================================================
  // COLOR
  // ==========================================================

  const asksColor =
    text.includes('konsa colour') ||
    text.includes('kaunsa colour') ||
    text.includes('konsa color') ||
    text.includes('kaunsa color') ||
    text.includes('which colour') ||
    text.includes('which color');


  if (asksColor) {

    const colorMemory =
      memory.find(fact => {

        const f =
          normalize(fact);

        return (
          f.includes('likes blue') ||
          f.includes('likes red') ||
          f.includes('likes green') ||
          f.includes('likes black') ||
          f.includes('likes white') ||
          f.includes('likes yellow') ||
          f.includes('likes pink') ||
          f.includes('likes purple') ||
          f.includes('likes orange') ||
          f.includes('likes brown') ||
          f.includes('likes grey') ||
          f.includes('likes gray')
        );

      });


    if (colorMemory) {

      const match =
        colorMemory.match(
          /likes (blue|red|green|black|white|yellow|pink|purple|orange|brown|grey|gray)/i
        );


      if (match) {

        return (
          match[1].charAt(0).toUpperCase() +
          match[1].slice(1) +
          ' 😌'
        );

      }

    }

  }


  // ==========================================================
  // FOOD
  // ==========================================================

  const asksFood =
    text.includes('kya khana pasand') ||
    text.includes('kya khana acha lagta') ||
    text.includes('favourite food') ||
    text.includes('favorite food');


  if (asksFood) {

    const foodMemory =
      memory.find(fact => {

        const f =
          normalize(fact);

        return (
          f.includes('favorite food') ||
          f.includes('favourite food') ||
          f.includes('likes pizza') ||
          f.includes('likes biryani')
        );

      });


    if (foodMemory) {

      const match =
        foodMemory.match(
          /(?:favorite|favourite food is|likes)\s+(.+)/i
        );


      if (match) {

        return (
          match[1]
            .replace(/^is\s+/i, '')
            .trim()
            .replace(/\.$/, '') +
          ' 😌'
        );

      }

    }

  }


  // ==========================================================
  // GENERAL "WHAT DO I LIKE?"
  // ==========================================================

  const asksLikes =
    text === 'mujhe kya pasand hai' ||
    text === 'mujhe kya kya pasand hai' ||
    text === 'what do i like' ||
    text === 'what things do i like';


  if (asksLikes) {

    if (memory.length === 0) {
      return null;
    }


    const useful =
      memory
        .slice(-5)
        .filter(Boolean);


    if (useful.length) {

      // Only return a simple fact instead of dumping memory.
      const first =
        useful[0];

      return first
        .replace(/^User\s*/i, '')
        .trim()
        .replace(/\.$/, '') +
        ' 😌';

    }

  }


  return null;
}


// ------------------------------------------------------------
// Neutral acknowledgements
// ------------------------------------------------------------

function getNeutralReply(userText) {

  const text =
    normalize(userText);


  const replies = {

    'hn': 'Hmm 😌',
    'hnn': 'Hmm 😌',
    'haan': 'Haan 😌',
    'ha': 'Haan.',
    'acha': 'Haan 😌',
    'achha': 'Haan 😌',
    'hmm': 'Hmm.',
    'hm': 'Hmm.',
    'ok': 'Okeyy.',
    'okay': 'Okayy.',
    'k': 'Haan.',
    'kk': 'Okayy.',
    'thik hai': 'Haan yaar.',
    'theek hai': 'Haan yaar.'
  };


  return replies[text] || null;
}


// ------------------------------------------------------------
// Goodbye
// ------------------------------------------------------------

function getGoodbyeReply(userText) {

  const text =
    normalize(userText);


  if (
    text === 'bye' ||
    text === 'byee' ||
    text === 'byeee' ||
    text === 'goodbye'
  ) {

    return 'Byee 😌';

  }


  if (
    text === 'good night' ||
    text === 'goodnight' ||
    text === 'gn' ||
    text === 'night'
  ) {

    return 'Good nightt 😴';

  }


  return null;
}


// ------------------------------------------------------------
// Main smart reply function
// ------------------------------------------------------------

function getSmartReply(
  userText,
  memory = []
) {

  // 1. Direct memory question
  const memoryReply =
    getMemoryAnswer(
      userText,
      memory
    );


  if (memoryReply) {
    return memoryReply;
  }


  // 2. Goodbye
  const goodbyeReply =
    getGoodbyeReply(
      userText
    );


  if (goodbyeReply) {
    return goodbyeReply;
  }


  // 3. Neutral acknowledgement
  const neutralReply =
    getNeutralReply(
      userText
    );


  if (neutralReply) {
    return neutralReply;
  }


  // 4. Nothing deterministic
  return null;
}


// ------------------------------------------------------------
// Export
// ------------------------------------------------------------

module.exports = {
  getSmartReply,
  getMemoryAnswer,
  getNeutralReply,
  getGoodbyeReply
};