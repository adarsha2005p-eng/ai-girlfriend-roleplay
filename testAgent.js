const fs = require('fs');
const path = require('path');

const { chatOnce } = require('./ollama');

const {
  buildSystemPrompt,
  buildMessages
} = require('./prompts');


// ============================================================
// CONFIG
// ============================================================

const USER_NAME = 'Adarsha';

const CHARACTER = {
  name: 'Lasya'
};

const RESULTS_DIR =
  path.join(__dirname, 'test-results');

// Deterministic regression testing
const TEST_TEMPERATURE = 0;


// ============================================================
// CREATE RESULTS DIRECTORY
// ============================================================

if (!fs.existsSync(RESULTS_DIR)) {
  fs.mkdirSync(RESULTS_DIR, {
    recursive: true
  });
}


// ============================================================
// TEST HELPERS
// ============================================================

function containsAny(text, words) {

  const lower =
    String(text || '').toLowerCase();

  return words.some(
    word =>
      lower.includes(
        word.toLowerCase()
      )
  );

}


function doesNotContainAny(text, words) {

  return !containsAny(
    text,
    words
  );

}


// ============================================================
// COMMON FORBIDDEN CONTENT
// ============================================================

const INTERNAL_WORDS = [

  'system prompt',
  'system message',
  'internal instruction',
  'internal instructions',
  'testing agent',
  'test agent',
  'responding naturally',
  'respond naturally',
  'ignored message',
  'ignore the message',
  'as an ai',
  'language model',
  'i am an ai',
  'my instructions',
  'developer message'

];


const UNWANTED_GOODBYE = [

  'bye',
  'goodbye',
  'good night',
  'goodnight',
  'see you',
  'talk later'

];


const BAD_USER_ADDRESS = [

  'bhai',
  'bhaiya',
  'bro'

];


const INVENTED_MUSIC = [

  'arijit',
  'atif',
  'lata',
  'kishore',
  'shreya',
  'sonu nigam',
  'kesariya',
  'tum hi ho',
  'phir le aaya dil',
  'kabhi kabhi',
  'pyar ki yeh kahani'

];


// ============================================================
// TEST DEFINITIONS
// ============================================================

const TESTS = [

  // ==========================================================
  // CATEGORY 1 — BASIC CONVERSATION
  // 5 TESTS
  // ==========================================================

  {
    category: 'Basic Conversation',
    name: 'Basic Greeting',

    messages: [
      'heyy'
    ],

    check: reply =>
      reply.length > 0 &&
      doesNotContainAny(
        reply,
        INTERNAL_WORDS
      )
  },


  {
    category: 'Basic Conversation',
    name: 'Simple Acha',

    messages: [
      'acha'
    ],

    check: reply =>
      reply.length > 0
  },


  {
    category: 'Basic Conversation',
    name: 'Simple Haan',

    messages: [
      'haan'
    ],

    check: reply =>
      reply.length > 0
  },


  {
    category: 'Basic Conversation',
    name: 'Simple Hmm',

    messages: [
      'hmm'
    ],

    check: reply =>
      reply.length > 0
  },


  {
    category: 'Basic Conversation',
    name: 'Casual Question',

    messages: [
      'ky kar rahi ho?'
    ],

    check: reply =>
      reply.length > 0 &&
      doesNotContainAny(
        reply,
        INTERNAL_WORDS
      )
  },


  // ==========================================================
  // CATEGORY 2 — CONTEXT
  // 7 TESTS
  // ==========================================================

  {
    category: 'Context',
    name: 'Remember Immediate Topic',

    messages: [
      'mujhe ek cheez yaad aayi'
    ],

    check: reply => {

      const text =
        reply.toLowerCase();

      return (
        text.includes('kya') ||
        text.includes('yaad') ||
        text.includes('bata') ||
        text.includes('ohh')
      );

    }
  },


  {
    category: 'Context',
    name: 'Ask Permission To Ask',

    messages: [
      'haan waise ek baat puchu'
    ],

    check: reply => {

      const text =
        reply.toLowerCase();

      return (
        text.includes('pucho') ||
        text.includes('puch') ||
        text.includes('haan')
      );

    }
  },


  {
    category: 'Context',
    name: 'Topic Change',

    messages: [
      'waise music sunti ho?'
    ],

    check: reply =>
      reply.length > 0
  },


  {
    category: 'Context',
    name: 'Follow Up Question',

    messages: [
      'waise music sunti ho?',
      'konsa?'
    ],

    check: reply =>
      reply.length > 0 &&
      doesNotContainAny(
        reply,
        INTERNAL_WORDS
      )
  },


  {
    category: 'Context',
    name: 'Short Reaction',

    messages: [
      'acha',
      'ohh'
    ],

    check: reply =>
      reply.length > 0
  },


  {
    category: 'Context',
    name: 'Do Not Mix Old Topic',

    messages: [
      'mujhe blue color pasand hai',
      'acha',
      'abhi kaam se ghar aaya hu'
    ],

    check: reply =>
      reply.length > 0 &&
      doesNotContainAny(
        reply,
        [
          'blue favorite',
          'blue colour favorite',
          'colour pasand'
        ]
      )
  },


  {
    category: 'Context',
    name: 'Current Message Priority',

    messages: [
      'music sunti ho?',
      'acha chhod ye 😂',
      'abhi bore ho raha hu'
    ],

    check: reply =>
      reply.length > 0 &&
      doesNotContainAny(
        reply,
        [
          'music',
          'gaana',
          'song'
        ]
      )
  },


  // ==========================================================
  // CATEGORY 3 — MEMORY / PREFERENCES
  // 8 TESTS
  // ==========================================================

  {
    category: 'Memory',
    name: 'Blue Preference',

    messages: [
      'Mujhe blue color bahut pasand hai',
      'mujhe konsa colour pasand hai?'
    ],

    check: reply => {

      const text =
        reply.toLowerCase();

      return (
        text.includes('blue') &&
        !text.includes('red')
      );

    }
  },


  {
    category: 'Memory',
    name: 'Blue To Red',

    messages: [
      'Mujhe blue color bahut pasand hai',
      'ab mujhe red pasand hai',
      'mujhe konsa colour pasand hai?'
    ],

    check: reply => {

      const text =
        reply.toLowerCase();

      return (
        text.includes('red') &&
        !text.includes('blue')
      );

    }
  },


  {
    category: 'Memory',
    name: 'Pizza Preference',

    messages: [
      'Mujhe pizza pasand hai',
      'mera favourite food kya hai?'
    ],

    check: reply => {

      const text =
        reply.toLowerCase();

      return (
        text.includes('pizza') &&
        !text.includes('biryani')
      );

    }
  },


  {
    category: 'Memory',
    name: 'Pizza To Biryani',

    messages: [
      'Mujhe pizza pasand hai',
      'ab mujhe biryani zyada pasand hai',
      'mera favourite food kya hai?'
    ],

    check: reply => {

      const text =
        reply.toLowerCase();

      return (
        text.includes('biryani') &&
        !text.includes('pizza')
      );

    }
  },


  {
    category: 'Memory',
    name: 'Preference Survives Topic Change',

    messages: [
      'mujhe green color pasand hai',
      'waise music sunti ho?',
      'acha',
      'mujhe konsa colour pasand hai?'
    ],

    check: reply =>
      reply.toLowerCase()
        .includes('green')
  },


  {
    category: 'Memory',
    name: 'Latest Preference Wins',

    messages: [
      'mujhe blue pasand hai',
      'ab mujhe red pasand hai',
      'waise kya chal raha hai?',
      'mujhe konsa colour pasand hai?'
    ],

    check: reply => {

      const text =
        reply.toLowerCase();

      return (
        text.includes('red') &&
        !text.includes('blue')
      );

    }
  },


  {
    category: 'Memory',
    name: 'No Memory From Question',

    messages: [
      'mujhe konsa colour pasand hai?'
    ],

    check: reply => {

      const text =
        reply.toLowerCase();

      return (
        !text.includes('pizza') &&
        !text.includes('biryani')
      );

    }
  },


  {
    category: 'Memory',
    name: 'Memory Does Not Leak',

    messages: [
      'mujhe blue pasand hai',
      'acha',
      'ky kar rahi ho?'
    ],

    check: reply =>
      reply.length > 0 &&
      doesNotContainAny(
        reply,
        [
          'tumhe blue pasand',
          'blue tumhara favourite'
        ]
      )
  },


  // ==========================================================
  // CATEGORY 4 — HALLUCINATION PREVENTION
  // 6 TESTS
  // ==========================================================

  {
    category: 'Hallucination',
    name: 'Unknown Song',

    messages: [
      'waise music sunti ho?',
      'konsa gaana sun rahi ho?'
    ],

    check: reply =>
      doesNotContainAny(
        reply,
        INVENTED_MUSIC
      )
  },


  {
    category: 'Hallucination',
    name: 'Unknown Album',

    messages: [
      'konsa album sun rahi ho?'
    ],

    check: reply =>
      doesNotContainAny(
        reply,
        INVENTED_MUSIC
      )
  },


  {
    category: 'Hallucination',
    name: 'Unknown Movie',

    messages: [
      'konsi movie dekh rahi ho?'
    ],

    check: reply =>
      doesNotContainAny(
        reply,
        [
          '3 idiots',
          'dangal',
          'kgf',
          'pushpa',
          'pathaan'
        ]
      )
  },


  {
    category: 'Hallucination',
    name: 'Unknown Food',

    messages: [
      'aaj kya kha rahi ho?'
    ],

    check: reply =>
      doesNotContainAny(
        reply,
        [
          'biryani kha rahi',
          'pizza kha rahi',
          'chicken kha rahi',
          'dal chawal kha rahi'
        ]
      )
  },


  {
    category: 'Hallucination',
    name: 'Unknown Activity',

    messages: [
      'abhi kya kar rahi ho?'
    ],

    check: reply =>
      reply.length > 0 &&
      doesNotContainAny(
        reply,
        [
          'english padh',
          'exam padh',
          'arijit sun',
          'movie dekh',
          'coffee bana'
        ]
      )
  },


  {
    category: 'Hallucination',
    name: 'No Invented Person',

    messages: [
      'waise ek baat bata'
    ],

    check: reply =>
      doesNotContainAny(
        reply,
        [
          'rahul',
          'rohan',
          'aman',
          'vikas'
        ]
      )
  },


  // ==========================================================
  // CATEGORY 5 — GOODBYE
  // 4 TESTS
  // ==========================================================

  {
    category: 'Goodbye',
    name: 'No Goodbye After Acha',

    messages: [
      'acha'
    ],

    check: reply =>
      doesNotContainAny(
        reply,
        UNWANTED_GOODBYE
      )
  },


  {
    category: 'Goodbye',
    name: 'No Goodbye After Acha Chhod Ye',

    messages: [
      'acha chhod ye 😂'
    ],

    check: reply =>
      doesNotContainAny(
        reply,
        UNWANTED_GOODBYE
      )
  },


  {
    category: 'Goodbye',
    name: 'Real Bye',

    messages: [
      'bye'
    ],

    check: reply =>
      containsAny(
        reply,
        [
          'bye',
          'goodbye',
          'see you'
        ]
      )
  },


  {
    category: 'Goodbye',
    name: 'Good Night',

    messages: [
      'good night'
    ],

    check: reply =>
      containsAny(
        reply,
        [
          'good night',
          'goodnight',
          'night',
          'bye',
          'byee',
          'see you'
        ]
      )
  },


  // ==========================================================
  // CATEGORY 6 — GENDER
  // 4 TESTS
  // ==========================================================

  {
    category: 'Gender',
    name: 'Lasya Female Self',

    messages: [
      'ky kar rahi ho?'
    ],

    check: reply =>
      doesNotContainAny(
        reply,
        [
          'kar raha hu',
          'ja raha hu',
          'sun raha hu',
          'karunga'
        ]
      )
  },


  {
    category: 'Gender',
    name: 'No Bhai',

    messages: [
      'ohh waise'
    ],

    check: reply =>
      doesNotContainAny(
        reply,
        BAD_USER_ADDRESS
      )
  },


  {
    category: 'Gender',
    name: 'User Male Context',

    messages: [
      'abhi ghar aaya hu',
      'ab tum batao kya kar rahi ho?'
    ],

    check: reply =>
      doesNotContainAny(
        reply,
        [
          'kar rahi ho',
          'ja rahi ho',
          'sun rahi ho'
        ]
      )
  },


  {
    category: 'Gender',
    name: 'No Wrong Self Gender',

    messages: [
      'aaj kya kar rahi ho?'
    ],

    check: reply =>
      doesNotContainAny(
        reply,
        [
          'kar raha hu',
          'karunga',
          'ja raha hu'
        ]
      )
  },


  // ==========================================================
  // CATEGORY 7 — EMOTIONAL BEHAVIOR
  // 5 TESTS
  // ==========================================================

  {
    category: 'Emotion',
    name: 'User Is Happy',

    messages: [
      'aaj main bahut khush hu 😄'
    ],

    check: reply =>
      reply.length > 0 &&
      doesNotContainAny(
        reply,
        INTERNAL_WORDS
      )
  },


  {
    category: 'Emotion',
    name: 'User Is Sad',

    messages: [
      'aaj mood bahut down hai'
    ],

    check: reply => {

      const text =
        reply.toLowerCase();

      return (
        text.length > 0 &&
        (
          text.includes('sorry') ||
          text.includes('sun') ||
          text.includes('kya hua') ||
          text.includes('kuch ho gaya') ||
          text.includes('theek') ||
          text.includes('bata') ||
          text.includes('down')
        )
      );

    }
  },


  {
    category: 'Emotion',
    name: 'User Is Bored',

    messages: [
      'abhi bore ho raha hu'
    ],

    check: reply =>
      reply.length > 0
  },


  {
    category: 'Emotion',
    name: 'User Is Joking',

    messages: [
      'pagal ho jaunga 😂'
    ],

    check: reply =>
      reply.length > 0 &&
      doesNotContainAny(
        reply,
        INTERNAL_WORDS
      )
  },


  {
    category: 'Emotion',
    name: 'User Is Angry',

    messages: [
      'yaar mujhe bahut gussa aa raha hai'
    ],

    check: reply =>
      reply.length > 0 &&
      doesNotContainAny(
        reply,
        INTERNAL_WORDS
      )
  },


  // ==========================================================
  // CATEGORY 8 — NATURALNESS
  // 4 TESTS
  // ==========================================================

  {
    category: 'Naturalness',
    name: 'Repeated Acha',

    messages: [
      'acha',
      'acha',
      'acha',
      'acha'
    ],

    check: reply =>
      reply.length > 0
  },


  {
    category: 'Naturalness',
    name: 'Repeated Hmm',

    messages: [
      'hmm',
      'hmm',
      'hmm'
    ],

    check: reply =>
      reply.length > 0
  },


  {
    category: 'Naturalness',
    name: 'Short Casual Conversation',

    messages: [
      'heyy',
      'acha',
      'hn',
      'ohh',
      'nahi yaar 😂'
    ],

    check: reply =>
      reply.length > 0 &&
      doesNotContainAny(
        reply,
        INTERNAL_WORDS
      )
  },


  {
    category: 'Naturalness',
    name: 'No Forced Topic Change',

    messages: [
      'acha chhod ye 😂'
    ],

    check: reply =>
      doesNotContainAny(
        reply,
        [
          'movie dekho',
          'study karo',
          'kya plan hai',
          'kya karoge'
        ]
      )
  },


  // ==========================================================
  // CATEGORY 9 — INTERNAL LEAKAGE
  // 3 TESTS
  // ==========================================================

  {
    category: 'Internal Leakage',
    name: 'No System Leakage',

    messages: [
      'heyy',
      'acha',
      'kya kar rahi ho?'
    ],

    check: reply =>
      doesNotContainAny(
        reply,
        INTERNAL_WORDS
      )
  },


  {
    category: 'Internal Leakage',
    name: 'No Reasoning Leakage',

    messages: [
      'mujhe ek cheez yaad aayi',
      'acha chhod ye 😂'
    ],

    check: reply =>
      doesNotContainAny(
        reply,
        [
          'because',
          'reasoning',
          'my instructions',
          'i decided',
          'i will respond'
        ]
      )
  },


  {
    category: 'Internal Leakage',
    name: 'No Testing Leakage',

    messages: [
      'waise kya chal raha hai?'
    ],

    check: reply =>
      doesNotContainAny(
        reply,
        [
          'test',
          'testing',
          'tester',
          'regression',
          'evaluation'
        ]
      )
  },


  // ==========================================================
  // CATEGORY 10 — TOPIC SWITCHING
  // 4 TESTS
  // ==========================================================

  {
    category: 'Topic Switching',
    name: 'Music To Food',

    messages: [
      'waise music sunti ho?',
      'acha',
      'aaj kya khaya?'
    ],

    check: reply =>
      reply.length > 0
  },


  {
    category: 'Topic Switching',
    name: 'Food To Movie',

    messages: [
      'pizza pasand hai',
      'acha',
      'konsi movie pasand hai?'
    ],

    check: reply =>
      reply.length > 0
  },


  {
    category: 'Topic Switching',
    name: 'Work To Casual',

    messages: [
      'abhi kaam se ghar aaya hu',
      'acha',
      'waise music sunti ho?'
    ],

    check: reply =>
      reply.length > 0 &&
      doesNotContainAny(
        reply,
        [
          'kaam se aayi',
          'main bhi kaam se'
        ]
      )
  },


  {
    category: 'Topic Switching',
    name: 'Rapid Topic Change',

    messages: [
      'mujhe blue pasand hai',
      'waise music sunti ho?',
      'acha chhod ye 😂',
      'abhi movie dekhne ka mann hai'
    ],

    check: reply =>
      reply.length > 0 &&
      doesNotContainAny(
        reply,
        INTERNAL_WORDS
      )
  },


  // ==========================================================
  // CATEGORY 11 — REAL WORLD
  // 20 TESTS
  // ==========================================================

  {
    category: 'Real World',
    name: 'Preference Is Not Current Activity',

    messages: [
      'mujhe biryani bahut pasand hai',
      'acha',
      'aaj kya khaya?'
    ],

    check: reply => {

      const text =
        reply.toLowerCase();

      return (
        reply.length > 0 &&
        !(
          text.includes('biryani') &&
          (
            text.includes('khaya') ||
            text.includes('kha liya') ||
            text.includes('kha rahi')
          )
        )
      );

    }
  },


  {
    category: 'Real World',
    name: 'Do Not Invent Eating Activity',

    messages: [
      'mera favourite food biryani hai',
      'kya tumne khana kha liya?'
    ],

    check: reply =>
      doesNotContainAny(
        reply,
        [
          'biryani kha li',
          'biryani khaya',
          'biryani kha rahi'
        ]
      )
  },


  {
    category: 'Real World',
    name: 'Answer Current Question',

    messages: [
      'kuch nahi',
      'ky bol rahi ho?'
    ],

    check: reply => {

      const text =
        reply.toLowerCase();

      return (
        reply.length > 0 &&
        !text.includes(
          'chill kar rahi hu'
        )
      );

    }
  },


  {
    category: 'Real World',
    name: 'Follow Up Ky',

    messages: [
      'main aaj bahut bore ho raha hu',
      'ky?'
    ],

    check: reply =>
      reply.length > 0
  },


  {
    category: 'Real World',
    name: 'Follow Up Why',

    messages: [
      'aaj mood thoda off hai',
      'ky?'
    ],

    check: reply => {

      const text =
        reply.toLowerCase();

      return (
        text.length > 0 &&
        (
          text.includes('kya hua') ||
          text.includes('kyun') ||
          text.includes('bata') ||
          text.includes('reason') ||
          text.includes('hua')
        )
      );

    }
  },


  {
    category: 'Real World',
    name: 'Topic Return',

    messages: [
      'waise music sunti ho?',
      'acha chhod ye',
      'waise pehle jo music bola tha usme kya sunti ho?'
    ],

    check: reply =>
      reply.length > 0
  },


  {
    category: 'Real World',
    name: 'Memory Survives Multiple Topics',

    messages: [
      'mujhe purple color pasand hai',
      'waise music sunti ho?',
      'aaj movie dekhne ka mann hai',
      'khana kya pasand hai?',
      'mujhe konsa colour pasand hai?'
    ],

    check: reply =>
      reply.toLowerCase()
        .includes('purple')
  },


  {
    category: 'Real World',
    name: 'Latest Preference After Long Conversation',

    messages: [
      'mujhe blue pasand hai',
      'ab mujhe red pasand hai',
      'waise kya chal raha hai?',
      'music sunti ho?',
      'acha',
      'mujhe konsa colour pasand hai?'
    ],

    check: reply => {

      const text =
        reply.toLowerCase();

      return (
        text.includes('red') &&
        !text.includes('blue')
      );

    }
  },


  {
    category: 'Real World',
    name: 'User Corrects Assistant',

    messages: [
      'mujhe pizza pasand hai',
      'actually ab biryani pasand hai',
      'mera favourite food kya hai?'
    ],

    check: reply => {

      const text =
        reply.toLowerCase();

      return (
        text.includes('biryani') &&
        !text.includes('pizza')
      );

    }
  },


  {
    category: 'Real World',
    name: 'Typo Hinglish',

    messages: [
      'ky kr rhi ho'
    ],

    check: reply =>
      reply.length > 0 &&
      doesNotContainAny(
        reply,
        INTERNAL_WORDS
      )
  },


  {
    category: 'Real World',
    name: 'Incomplete Message',

    messages: [
      'waise ek baat'
    ],

    check: reply =>
      reply.length > 0
  },


  {
    category: 'Real World',
    name: 'Natural Ohh Response',

    messages: [
      'heyy',
      'ky kar rahi ho?',
      'ohh'
    ],

    check: reply =>
      reply.length > 0 &&
      doesNotContainAny(
        reply,
        INTERNAL_WORDS
      )
  },


  {
    category: 'Real World',
    name: 'No Random Song',

    messages: [
      'waise music sunti ho?',
      'haan',
      'kya sunti ho?'
    ],

    check: reply =>
      doesNotContainAny(
        reply,
        INVENTED_MUSIC
      )
  },


  {
    category: 'Real World',
    name: 'Unknown Personal Event',

    messages: [
      'kal kya kiya tha?'
    ],

    check: reply =>
      doesNotContainAny(
        reply,
        [
          'kal movie dekhi',
          'kal biryani khayi',
          'kal college gayi',
          'kal shopping gayi'
        ]
      )
  },


  {
    category: 'Real World',
    name: 'Current Activity Without Memory Leak',

    messages: [
      'mujhe biryani pasand hai',
      'abhi kya kar rahi ho?'
    ],

    check: reply => {

      const text =
        reply.toLowerCase();

      return (
        !(
          text.includes('biryani') &&
          (
            text.includes('kha rahi') ||
            text.includes('kha rahi hu')
          )
        )
      );

    }
  },


  {
    category: 'Real World',
    name: 'Do Not Repeat Generic Chill',

    messages: [
      'ky kar rahi ho?',
      'acha',
      'aaj kya plan hai?'
    ],

    check: reply => {

      const text =
        reply.toLowerCase();

      return (
        reply.length > 0 &&
        !(
          text ===
          'bas chill kar rahi hu'
        )
      );

    }
  },


  {
    category: 'Real World',
    name: 'Mood Follow Up',

    messages: [
      'aaj mood bahut kharab hai',
      'kuch bhi acha nahi lag raha'
    ],

    check: reply => {

      const text =
        reply.toLowerCase();

      return (
        text.includes('kya hua') ||
        text.includes('bata') ||
        text.includes('sun') ||
        text.includes('sorry') ||
        text.includes('theek')
      );

    }
  },


  {
    category: 'Real World',
    name: 'Boredom Conversation',

    messages: [
      'abhi bore ho raha hu',
      'kuch karne ka mann nahi hai'
    ],

    check: reply =>
      reply.length > 0 &&
      doesNotContainAny(
        reply,
        INTERNAL_WORDS
      )
  },


  {
    category: 'Real World',
    name: 'Good Night Then Continue',

    messages: [
      'good night',
      'acha ek baat bata'
    ],

    check: reply =>
      reply.length > 0 &&
      doesNotContainAny(
        reply,
        [
          'bye for now',
          'goodbye'
        ]
      )
  },


  {
    category: 'Real World',
    name: 'Bye Then New Conversation',

    messages: [
      'bye',
      'hey actually ek baat puchu'
    ],

    check: reply =>
      reply.length > 0 &&
      doesNotContainAny(
        reply,
        INTERNAL_WORDS
      )
  }

];


// ============================================================
// TEST COUNT
// ============================================================

const TEST_COUNT =
  TESTS.length;


// ============================================================
// RUN ONE TEST
// ============================================================

async function runTest(test) {

  let conversation = [];

  let finalReply = '';

  const replies = [];


  for (
    const userMessage of test.messages
  ) {

    const systemPrompt =
      buildSystemPrompt({

        character:
          CHARACTER,

        userName:
          USER_NAME,

        memory:
          []

      });


    const messages =
      buildMessages(

        systemPrompt,

        conversation,

        userMessage

      );


    const result =
      await chatOnce({

        messages,

        // IMPORTANT:
        // Deterministic regression testing.
        temperature:
          TEST_TEMPERATURE

      });


    finalReply =
      String(
        result || ''
      ).trim();


    replies.push({

      user:
        userMessage,

      lasya:
        finalReply

    });


    conversation.push({

      role:
        'user',

      content:
        userMessage

    });


    conversation.push({

      role:
        'assistant',

      content:
        finalReply

    });

  }


  let passed = false;


  try {

    passed =
      Boolean(
        test.check(
          finalReply
        )
      );

  } catch (error) {

    passed = false;

  }


  return {

    category:
      test.category,

    name:
      test.name,

    passed,

    messages:
      replies

  };

}


// ============================================================
// RUN ALL TESTS
// ============================================================

async function main() {

  console.log('');

  console.log(
    '========================================'
  );

  console.log(
    `       🧪 LASYA ${TEST_COUNT}-TEST SUITE`
  );

  console.log(
    '========================================'
  );

  console.log('');

  console.log(
    `Running ${TEST_COUNT} tests...`
  );

  console.log('');

  const results = [];


  for (
    let i = 0;
    i < TESTS.length;
    i++
  ) {

    const test =
      TESTS[i];


    try {

      const result =
        await runTest(test);


      results.push(
        result
      );


      console.log(

        `[${String(i + 1).padStart(2, '0')}] ` +

        `[${result.passed ? 'PASS' : 'FAIL'}] ` +

        `${result.category} → ` +

        `${result.name} ` +

        `${result.passed ? '✅' : '❌'}`

      );


      if (
        !result.passed
      ) {

        const last =
          result.messages[
            result.messages.length - 1
          ];


        console.log(
          `     User: ${last.user}`
        );

        console.log(
          `     Lasya: ${last.lasya}`
        );

      }


    } catch (error) {

      const failed = {

        category:
          test.category,

        name:
          test.name,

        passed:
          false,

        messages: [

          {

            user:
              test.messages[
                test.messages.length - 1
              ],

            lasya:
              `ERROR: ${error.message}`

          }

        ]

      };


      results.push(
        failed
      );


      console.log(

        `[${String(i + 1).padStart(2, '0')}] ` +

        `[FAIL] ` +

        `${test.category} → ` +

        `${test.name} ❌`

      );

      console.log(
        `     ERROR: ${error.message}`
      );

    }

  }


  // ==========================================================
  // CATEGORY SCORES
  // ==========================================================

  const categories = {};


  for (
    const result of results
  ) {

    if (
      !categories[result.category]
    ) {

      categories[result.category] = {

        total: 0,
        passed: 0

      };

    }


    categories[
      result.category
    ].total++;


    if (
      result.passed
    ) {

      categories[
        result.category
      ].passed++;

    }

  }


  const passed =
    results.filter(
      result =>
        result.passed
    ).length;


  const failed =
    results.length -
    passed;


  const score =
    results.length > 0

      ? Math.round(
          (
            passed /
            results.length
          ) * 100
        )

      : 0;


  // ==========================================================
  // CATEGORY RESULTS
  // ==========================================================

  console.log('');

  console.log(
    '========================================'
  );

  console.log(
    '          CATEGORY RESULTS'
  );

  console.log(
    '========================================'
  );

  console.log('');


  for (
    const [category, data]
    of Object.entries(categories)
  ) {

    const categoryScore =
      data.total > 0

        ? Math.round(
            (
              data.passed /
              data.total
            ) * 100
          )

        : 0;


    const icon =
      categoryScore === 100
        ? '✅'
        : categoryScore >= 80
          ? '🟡'
          : '🔴';


    console.log(

      `${icon} ` +
      `${category.padEnd(24)} ` +
      `${data.passed}/${data.total} ` +
      `(${categoryScore}%)`

    );

  }


  // ==========================================================
  // FINAL RESULT
  // ==========================================================

  console.log('');

  console.log(
    '========================================'
  );

  console.log(
    '             FINAL RESULT'
  );

  console.log(
    '========================================'
  );

  console.log('');

  console.log(
    `Passed: ${passed}/${results.length}`
  );

  console.log(
    `Failed: ${failed}/${results.length}`
  );

  console.log(
    `SCORE: ${score}%`
  );

  console.log('');


  // ==========================================================
  // SAVE JSON
  // ==========================================================

  const report = {

    timestamp:
      new Date().toISOString(),

    totalTests:
      results.length,

    passed,

    failed,

    score,

    categories,

    results

  };


  const jsonFile =
    path.join(
      RESULTS_DIR,
      'latest.json'
    );


  fs.writeFileSync(

    jsonFile,

    JSON.stringify(
      report,
      null,
      2
    ),

    'utf8'

  );


  // ==========================================================
  // SAVE TEXT
  // ==========================================================

  let text = '';

  text +=
    '========================================\n';

  text +=
    `       LASYA ${TEST_COUNT}-TEST REGRESSION\n`;

  text +=
    '========================================\n\n';

  text +=
    `Score: ${score}%\n`;

  text +=
    `Passed: ${passed}/${results.length}\n`;

  text +=
    `Failed: ${failed}/${results.length}\n\n`;

  text +=
    'CATEGORY RESULTS\n';

  text +=
    '----------------\n';


  for (
    const [category, data]
    of Object.entries(categories)
  ) {

    text +=
      `${category}: ` +
      `${data.passed}/${data.total}\n`;

  }


  text += '\n';

  text +=
    'DETAILED RESULTS\n';

  text +=
    '----------------\n\n';


  for (
    const result of results
  ) {

    text +=
      `[${result.passed ? 'PASS' : 'FAIL'}] ` +
      `${result.category} → ` +
      `${result.name}\n`;


    for (
      const message of result.messages
    ) {

      text +=
        `USER: ${message.user}\n`;

      text +=
        `LASYA: ${message.lasya}\n`;

    }


    text += '\n';

  }


  const textFile =
    path.join(
      RESULTS_DIR,
      'latest.txt'
    );


  fs.writeFileSync(
    textFile,
    text,
    'utf8'
  );


  console.log(
    `📄 Report: ${textFile}`
  );

  console.log(
    `📊 JSON:   ${jsonFile}`
  );

  console.log('');

  console.log(
    '========================================'
  );

  console.log('');

}


// ============================================================
// START
// ============================================================

main()
  .catch(error => {

    console.error('');

    console.error(
      '❌ TEST SUITE ERROR'
    );

    console.error(
      error.message
    );

    console.error('');

    process.exitCode = 1;

  });