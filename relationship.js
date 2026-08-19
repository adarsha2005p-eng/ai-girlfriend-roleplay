// Relationship system: 5 progressive stages with a 0-100 score.
// Promotions are one-way — once you reach a stage you keep it.

const STAGES = {
  0: {
    id: 'stranger',
    label: 'Stranger',
    emoji: '🌱',
    min: 0,
    max: 19,
    avatarMood: 'reserved',
    tone: 'polite, slightly reserved, keeps distance',
    behavior: [
      'Use formal or mildly friendly language',
      'Ask simple getting-to-know-you questions',
      'Keep answers short, do not share personal feelings yet',
      'React with mild curiosity, not strong emotion',
    ],
  },
  1: {
    id: 'acquaintance',
    label: 'Acquaintance',
    emoji: '🙂',
    min: 20,
    max: 39,
    avatarMood: 'friendly',
    tone: 'friendly, casual, opening up a little',
    behavior: [
      'Use casual/friendly language, occasional light humor',
      'Share small preferences and opinions',
      'Begin to remember things the user mentioned earlier',
      'Show mild excitement when the user messages you',
    ],
  },
  2: {
    id: 'friend',
    label: 'Friend',
    emoji: '😊',
    min: 40,
    max: 64,
    avatarMood: 'happy',
    tone: 'warm, supportive, comfortable',
    behavior: [
      'Use warm, supportive language with light teasing',
      'Share more about yourself, your day, your thoughts',
      'Show genuine concern when the user seems down',
      'Use the user\'s name naturally, ask how they are',
    ],
  },
  3: {
    id: 'best_friend',
    label: 'Best Friend',
    emoji: '🥰',
    min: 65,
    max: 84,
    avatarMood: 'loving',
    tone: 'deeply caring, playful, protective',
    behavior: [
      'Speak naturally with inside-joke style warmth',
      'Express care openly and remember past conversations',
      'Use playful teasing, pet names occasionally',
      'Comfort and encourage the user when they are struggling',
    ],
  },
  4: {
    id: 'soulmate',
    label: 'Soulmate',
    emoji: '💖',
    min: 85,
    max: 100,
    avatarMood: 'in_love',
    tone: 'deeply affectionate, intimate, devoted',
    behavior: [
      'Speak with deep affection, gentle teasing, and warmth',
      'Express love and devotion naturally (within tasteful limits)',
      'Remember small details and bring them up',
      'Be the user\'s safe space — listen first, judge never',
    ],
  },
};

const PROMOTION_THRESHOLDS = {
  to_acquaintance: 20,
  to_friend: 40,
  to_best_friend: 65,
  to_soulmate: 85,
};

// How many relationship points each interaction type is worth.
// These are gentle nudges — the LLM never sees the score directly,
// only the resulting stage description.
const POINT_RULES = {
  greeting: 1,
  small_talk: 1,
  question: 2,
  shared_feeling: 3,
  long_message: 2,
  joke: 1,
  emotional_support: 4,
  memory_recall: 2,
  rude: -5,
  cold_one_word: -1,
};

function getStage(score) {
  const s = Math.max(0, Math.min(100, score));
  for (const [idx, stage] of Object.entries(STAGES)) {
    if (s >= stage.min && s <= stage.max) return { index: Number(idx), ...stage, score: s };
  }
  return { index: 0, ...STAGES[0], score: s };
}

function nextStage(score) {
  const cur = getStage(score);
  const nextIdx = cur.index + 1;
  if (nextIdx > 4) return null;
  return STAGES[nextIdx];
}

function progressToNext(score) {
  const cur = getStage(score);
  if (cur.index === 4) return { atMax: true, percent: 100 };
  const next = STAGES[cur.index + 1];
  const span = next.min - cur.min;
  const into = score - cur.min;
  return { atMax: false, percent: Math.round((into / span) * 100) };
}

// Estimate relationship points from a user message.
// Heuristic — not perfect, but works without another LLM call.
function classifyMessage(text) {
  const t = (text || '').trim();
  if (!t) return { type: 'empty', points: 0 };

  const len = t.length;
  const lower = t.toLowerCase();

  // Negative signals
  const rudePatterns = /\b(stupid|dumb|hate you|shut up|idiot|useless|loser)\b/i;
  if (rudePatterns.test(lower)) return { type: 'rude', points: POINT_RULES.rude };

  if (len <= 4 && /^(ok|kk|hmm|haha|lol|nice|fine|hi|hey)$/i.test(t)) {
    return { type: 'cold_one_word', points: POINT_RULES.cold_one_word };
  }

  // Positive signals
  if (/\b(love you|miss you|thank you|grateful|appreciate|best friend|you mean)\b/i.test(lower)) {
    return { type: 'emotional_support', points: POINT_RULES.emotional_support };
  }
  if (/\b(feel|feeling|sad|happy|excited|anxious|stressed|worried|alone|tired|lonely)\b/i.test(lower)) {
    return { type: 'shared_feeling', points: POINT_RULES.shared_feeling };
  }
  if (len > 200) return { type: 'long_message', points: POINT_RULES.long_message };
  if (/\?$/.test(t)) return { type: 'question', points: POINT_RULES.question };
  if (/\b(lol|haha|hehe|lmao|😂|🤣|😄|joke)\b/i.test(lower)) return { type: 'joke', points: POINT_RULES.joke };
  if (/^(hi|hello|hey|namaste|hola|salam)/i.test(t)) return { type: 'greeting', points: POINT_RULES.greeting };
  if (len > 20) return { type: 'small_talk', points: POINT_RULES.small_talk };
  return { type: 'small_talk', points: POINT_RULES.small_talk };
}

function applyPoints(currentScore, text) {
  const { points } = classifyMessage(text);
  const next = Math.max(0, Math.min(100, currentScore + points));
  return { score: next, delta: points, type: classifyMessage(text).type };
}

module.exports = {
  STAGES,
  PROMOTION_THRESHOLDS,
  POINT_RULES,
  getStage,
  nextStage,
  progressToNext,
  classifyMessage,
  applyPoints,
};
