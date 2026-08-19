const { chatOnce } = require('./ollama');


// ============================================================
// AUTOMATIC MEMORY EXTRACTION
// ============================================================

async function extractMemories(userMessage, assistantReply) {

  if (!userMessage || !userMessage.trim()) {
    return [];
  }


  // ==========================================================
  // IGNORE VERY SHORT / NON-MEMORY MESSAGES
  // ==========================================================

  const shortMessages = [
    'ok',
    'okay',
    'k',
    'kk',
    'hmm',
    'hm',
    'acha',
    'achha',
    'haan',
    'hn',
    'hnn',
    'yes',
    'no',
    'lol',
    'haha',
    'hehe',
    'hi',
    'hii',
    'hey',
    'heyy',
    'hello',
    'bye',
    'gn',
    'good night',
    'goodnight',
    'good morning'
  ];


  const normalized =
    userMessage
      .toLowerCase()
      .trim();


  if (
    normalized.length < 8 ||
    shortMessages.includes(normalized)
  ) {
    return [];
  }


  // ==========================================================
  // MEMORY EXTRACTION PROMPT
  // ==========================================================

  const prompt = `
You are a long-term memory extraction system for a WhatsApp
conversation.

Analyze ONLY the USER MESSAGE.

Extract useful, durable facts about the USER that may be useful
in future conversations.

USER MESSAGE:
${userMessage}

ASSISTANT REPLY:
${assistantReply || ''}


==============================================================
IMPORTANT RULES
==============================================================

Only remember information clearly stated by the USER.

Never create a fact from the assistant's message.

Never guess.

Never assume.

Never save temporary situations.

Never save information about Lasya.

Never save a question as a memory.

Never save a joke as a memory.

Never save a greeting as a memory.


==============================================================
PREFERENCE CHANGES
==============================================================

THIS IS VERY IMPORTANT.

If the user changes an existing preference, return ONLY the
NEW preference.

Do NOT return the old preference.

Example:

User:
"Mujhe blue color pasand hai"

Return:

{
  "facts": [
    "User likes blue color"
  ]
}


Later:

User:
"Ab mujhe red color pasand hai"

Return:

{
  "facts": [
    "User likes red color"
  ]
}


Another example:

User:
"Ab mujhe blue nahi, red pasand hai"

Return:

{
  "facts": [
    "User likes red color"
  ]
}


Another example:

User:
"Pehele blue pasand tha par ab red pasand hai"

Return:

{
  "facts": [
    "User likes red color"
  ]
}


Another example:

User:
"Mene apna mind change kar diya, ab mujhe red pasand hai"

Return:

{
  "facts": [
    "User likes red color"
  ]
}


The latest preference is the one that matters.


==============================================================
GOOD EXAMPLES
==============================================================

User:
"I love blue color."

Return:

{
  "facts": [
    "User likes blue color"
  ]
}


User:
"Mujhe blue color bahut pasand hai."

Return:

{
  "facts": [
    "User likes blue color"
  ]
}


User:
"I prefer Hinglish."

Return:

{
  "facts": [
    "User prefers Hinglish"
  ]
}


User:
"I'm learning C programming."

Return:

{
  "facts": [
    "User is learning C programming"
  ]
}


User:
"My favorite food is biryani."

Return:

{
  "facts": [
    "User's favorite food is biryani"
  ]
}


User:
"Mujhe pizza pasand hai."

Return:

{
  "facts": [
    "User likes pizza"
  ]
}


User:
"Mujhe coding karna pasand hai."

Return:

{
  "facts": [
    "User likes coding"
  ]
}


==============================================================
BAD EXAMPLES
==============================================================

User:
"Heyy"

Return:

{
  "facts": []
}


User:
"I'm tired today."

Return:

{
  "facts": []
}


User:
"What should I eat?"

Return:

{
  "facts": []
}


User:
"haha"

Return:

{
  "facts": []
}


User:
"Ky kar rahi ho?"

Return:

{
  "facts": []
}


User:
"Aaj weather accha hai."

Return:

{
  "facts": []
}


==============================================================
DO NOT SAVE
==============================================================

Do NOT remember:

- greetings
- jokes
- temporary activities
- temporary moods
- temporary plans
- random questions
- assistant statements
- assumptions
- guesses
- passwords
- OTPs
- phone numbers
- addresses
- financial information
- private secrets
- medical information
- sexual information
- political beliefs
- religious beliefs
- highly sensitive personal information


==============================================================
MEMORY FORMAT
==============================================================

Each memory must be:

- short
- factual
- about the USER
- useful later
- clearly supported by the user's message

Maximum 3 facts.

Return ONLY valid JSON.

Required format:

{
  "facts": [
    "User likes blue color"
  ]
}

If there is nothing useful:

{
  "facts": []
}

Do not write anything outside the JSON.
`;


  // ==========================================================
  // ASK OLLAMA
  // ==========================================================

  try {

    const result =
      await chatOnce({

        messages: [

          {
            role: 'system',

            content:
              'You extract durable user facts. Return ONLY valid JSON.'
          },

          {
            role: 'user',

            content: prompt
          }

        ],

        temperature: 0.1

      });


    if (!result) {
      return [];
    }


    // ========================================================
    // CLEAN RESPONSE
    // ========================================================

    let cleaned =
      result.trim();


    cleaned =
      cleaned
        .replace(
          /^```json\s*/i,
          ''
        )
        .replace(
          /^```\s*/i,
          ''
        )
        .replace(
          /\s*```$/i,
          ''
        )
        .trim();


    // ========================================================
    // FIND JSON OBJECT
    // ========================================================

    const firstBrace =
      cleaned.indexOf('{');

    const lastBrace =
      cleaned.lastIndexOf('}');


    if (
      firstBrace !== -1 &&
      lastBrace !== -1 &&
      lastBrace > firstBrace
    ) {

      cleaned =
        cleaned.slice(
          firstBrace,
          lastBrace + 1
        );

    }


    // ========================================================
    // PARSE JSON
    // ========================================================

    const parsed =
      JSON.parse(cleaned);


    if (
      !parsed ||
      !Array.isArray(parsed.facts)
    ) {

      return [];

    }


    // ========================================================
    // VALIDATE FACTS
    // ========================================================

    const facts =
      parsed.facts

        .filter(
          fact =>
            typeof fact === 'string'
        )

        .map(
          fact =>
            fact.trim()
        )

        .filter(Boolean)

        .filter(
          fact =>
            fact.length <= 200
        )

        .slice(0, 3);


    return facts;


  } catch (err) {

    console.error(
      '🧠 Memory extraction failed:',
      err.message
    );

    return [];

  }

}


// ============================================================
// EXPORT
// ============================================================

module.exports = {
  extractMemories
};