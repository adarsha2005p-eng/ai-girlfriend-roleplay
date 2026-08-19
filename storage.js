const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data', 'users');


// ============================================================
// DIRECTORY HELPERS
// ============================================================

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

ensureDir(DATA_DIR);


function userDir(userId) {
  const safeId = String(userId)
    .replace(/[^a-zA-Z0-9_-]/g, '_');

  return path.join(DATA_DIR, safeId);
}


function sessionsDir(userId) {
  return path.join(
    userDir(userId),
    'sessions'
  );
}


function sessionDir(userId, sessionId) {
  const safeSessionId = String(sessionId)
    .replace(/[^a-zA-Z0-9_-]/g, '_');

  return path.join(
    sessionsDir(userId),
    safeSessionId
  );
}


// ============================================================
// JSON HELPERS
// ============================================================

function readJSON(file, fallback) {

  try {

    if (!fs.existsSync(file)) {
      return fallback;
    }

    const raw =
      fs.readFileSync(
        file,
        'utf8'
      );

    if (!raw.trim()) {
      return fallback;
    }

    return JSON.parse(raw);

  } catch (err) {

    console.error(
      `⚠️ Could not read JSON: ${file}`,
      err.message
    );

    return fallback;
  }
}


function writeJSON(file, data) {

  ensureDir(
    path.dirname(file)
  );

  fs.writeFileSync(
    file,
    JSON.stringify(
      data,
      null,
      2
    ),
    'utf8'
  );
}


function shortId() {

  return (
    Date.now().toString(36) +
    '-' +
    Math.random()
      .toString(36)
      .slice(2, 8)
  );

}


// ============================================================
// PROFILE
// ============================================================

function getProfile(userId) {

  return readJSON(
    path.join(
      userDir(userId),
      'profile.json'
    ),
    null
  );

}


function saveProfile(userId, profile) {

  const cleanProfile = {
    ...profile,
    updatedAt:
      new Date().toISOString()
  };

  writeJSON(
    path.join(
      userDir(userId),
      'profile.json'
    ),
    cleanProfile
  );

  return cleanProfile;
}


// ============================================================
// MEMORY
// ============================================================

function getMemory(userId) {

  const memory =
    readJSON(
      path.join(
        userDir(userId),
        'memory.json'
      ),
      {
        facts: []
      }
    );


  if (
    !memory ||
    !Array.isArray(memory.facts)
  ) {

    return {
      facts: []
    };

  }


  return memory;
}


// ============================================================
// ADD MEMORY
// ============================================================

function addMemory(userId, fact) {

  const trimmed =
    String(fact || '')
      .trim();


  if (!trimmed) {
    return getMemory(userId);
  }


  const memory =
    getMemory(userId);


  // Avoid duplicate memories
  const exists =
    memory.facts.some(
      existing =>
        existing.toLowerCase() ===
        trimmed.toLowerCase()
    );


  if (!exists) {

    memory.facts.push(
      trimmed
    );

  }


  // Keep the latest 50 memories
  if (
    memory.facts.length > 50
  ) {

    memory.facts =
      memory.facts.slice(-50);

  }


  writeJSON(
    path.join(
      userDir(userId),
      'memory.json'
    ),
    memory
  );


  return memory;
}


// ============================================================
// UPDATE MEMORY
// Replaces old conflicting preferences
// ============================================================

function updateMemory(userId, newFact) {

  const trimmed =
    String(newFact || '')
      .trim();


  if (!trimmed) {
    return getMemory(userId);
  }


  const memory =
    getMemory(userId);


  const newLower =
    trimmed.toLowerCase();


  // ==========================================================
  // COLOR PREFERENCE
  // ==========================================================

  const colorWords = [
    'blue',
    'red',
    'green',
    'black',
    'white',
    'yellow',
    'pink',
    'purple',
    'orange',
    'brown',
    'grey',
    'gray'
  ];


  const isColorPreference =
    colorWords.some(
      color =>
        newLower.includes(
          `likes ${color}`
        ) ||
        newLower.includes(
          `like ${color}`
        ) ||
        newLower.includes(
          `color is ${color}`
        ) ||
        newLower.includes(
          `colour is ${color}`
        )
    );


  // ==========================================================
  // REMOVE OLD COLOR PREFERENCE
  // ==========================================================

  if (isColorPreference) {

    memory.facts =
      memory.facts.filter(
        fact => {

          const lower =
            String(fact)
              .toLowerCase();


          return !colorWords.some(
            color =>
              lower.includes(
                `likes ${color}`
              ) ||
              lower.includes(
                `like ${color}`
              ) ||
              lower.includes(
                `color is ${color}`
              ) ||
              lower.includes(
                `colour is ${color}`
              )
          );

        }
      );

  }


  // ==========================================================
  // FOOD PREFERENCE
  // ==========================================================

  const foodWords = [
    'pizza',
    'biryani',
    'burger',
    'chicken',
    'pasta',
    'rice',
    'noodles'
  ];


  const isFoodPreference =
    foodWords.some(
      food =>
        newLower.includes(
          `likes ${food}`
        ) ||
        newLower.includes(
          `like ${food}`
        ) ||
        newLower.includes(
          `favorite food is ${food}`
        ) ||
        newLower.includes(
          `favourite food is ${food}`
        )
    );


  // ==========================================================
  // REMOVE OLD FOOD PREFERENCE
  // ==========================================================

  if (isFoodPreference) {

    memory.facts =
      memory.facts.filter(
        fact => {

          const lower =
            String(fact)
              .toLowerCase();


          return !foodWords.some(
            food =>
              lower.includes(
                `likes ${food}`
              ) ||
              lower.includes(
                `like ${food}`
              ) ||
              lower.includes(
                `favorite food is ${food}`
              ) ||
              lower.includes(
                `favourite food is ${food}`
              )
          );

        }
      );

  }


  // ==========================================================
  // ADD NEW FACT
  // ==========================================================

  const alreadyExists =
    memory.facts.some(
      existing =>
        String(existing)
          .toLowerCase() ===
        newLower
    );


  if (!alreadyExists) {

    memory.facts.push(
      trimmed
    );

  }


  // ==========================================================
  // KEEP LATEST 50
  // ==========================================================

  if (
    memory.facts.length > 50
  ) {

    memory.facts =
      memory.facts.slice(-50);

  }


  // ==========================================================
  // SAVE
  // ==========================================================

  writeJSON(
    path.join(
      userDir(userId),
      'memory.json'
    ),
    memory
  );


  return memory;
}


// ============================================================
// CLEAR MEMORY
// ============================================================

function clearMemory(userId) {

  writeJSON(
    path.join(
      userDir(userId),
      'memory.json'
    ),
    {
      facts: []
    }
  );

}


// ============================================================
// LEGACY MESSAGE MIGRATION
// ============================================================

function legacyMessagesPath(userId) {

  return path.join(
    userDir(userId),
    'messages.json'
  );

}


function hasSessions(userId) {

  return fs.existsSync(
    path.join(
      sessionsDir(userId),
      'index.json'
    )
  );

}


function migrateLegacy(userId) {

  if (hasSessions(userId)) {
    return;
  }


  const legacyFile =
    legacyMessagesPath(userId);


  if (
    !fs.existsSync(legacyFile)
  ) {

    return;

  }


  const messages =
    readJSON(
      legacyFile,
      []
    );


  const sessionId =
    'default';


  ensureDir(
    sessionDir(
      userId,
      sessionId
    )
  );


  writeJSON(
    path.join(
      sessionDir(
        userId,
        sessionId
      ),
      'messages.json'
    ),
    Array.isArray(messages)
      ? messages
      : []
  );


  const meta = {

    id: sessionId,

    title:
      messages.length
        ? 'WhatsApp Chat'
        : 'New chat',

    createdAt:
      new Date().toISOString(),

    lastActivity:
      new Date().toISOString(),

    msgCount:
      Array.isArray(messages)
        ? messages.length
        : 0

  };


  writeJSON(
    path.join(
      sessionDir(
        userId,
        sessionId
      ),
      'meta.json'
    ),
    meta
  );


  writeJSON(
    path.join(
      sessionsDir(userId),
      'index.json'
    ),
    [sessionId]
  );

}


// ============================================================
// SESSION INDEX
// ============================================================

function readIndex(userId) {

  migrateLegacy(userId);


  return readJSON(
    path.join(
      sessionsDir(userId),
      'index.json'
    ),
    []
  );

}


function writeIndex(
  userId,
  ids
) {

  writeJSON(
    path.join(
      sessionsDir(userId),
      'index.json'
    ),
    ids
  );

}


// ============================================================
// LIST SESSIONS
// ============================================================

function listSessions(userId) {

  const ids =
    readIndex(userId);


  const sessions = [];


  for (
    const id of ids
  ) {

    const meta =
      readJSON(
        path.join(
          sessionDir(
            userId,
            id
          ),
          'meta.json'
        ),
        null
      );


    if (meta) {
      sessions.push(meta);
    }

  }


  sessions.sort(
    (a, b) =>
      String(
        b.lastActivity || ''
      ).localeCompare(
        String(
          a.lastActivity || ''
        )
      )
  );


  return sessions;
}


// ============================================================
// GET SESSION
// ============================================================

function getSession(
  userId,
  sessionId
) {

  return readJSON(
    path.join(
      sessionDir(
        userId,
        sessionId
      ),
      'meta.json'
    ),
    null
  );

}


// ============================================================
// CREATE SESSION
// ============================================================

function createSession(
  userId,
  { title } = {}
) {

  ensureDir(
    sessionsDir(userId)
  );


  const id =
    shortId();


  const now =
    new Date().toISOString();


  const meta = {

    id,

    title:
      String(
        title || 'WhatsApp Chat'
      ).slice(0, 80),

    createdAt:
      now,

    lastActivity:
      now,

    msgCount:
      0

  };


  ensureDir(
    sessionDir(
      userId,
      id
    )
  );


  writeJSON(
    path.join(
      sessionDir(
        userId,
        id
      ),
      'meta.json'
    ),
    meta
  );


  writeJSON(
    path.join(
      sessionDir(
        userId,
        id
      ),
      'messages.json'
    ),
    []
  );


  const ids =
    readIndex(userId);


  ids.push(id);


  writeIndex(
    userId,
    ids
  );


  return meta;
}


// ============================================================
// TOUCH SESSION
// ============================================================

function touchSession(
  userId,
  sessionId
) {

  const meta =
    getSession(
      userId,
      sessionId
    );


  if (!meta) {
    return null;
  }


  meta.lastActivity =
    new Date().toISOString();


  writeJSON(
    path.join(
      sessionDir(
        userId,
        sessionId
      ),
      'meta.json'
    ),
    meta
  );


  return meta;
}


// ============================================================
// DELETE SESSION
// ============================================================

function deleteSession(
  userId,
  sessionId
) {

  const ids =
    readIndex(userId);


  if (
    !ids.includes(sessionId)
  ) {

    return false;

  }


  const dir =
    sessionDir(
      userId,
      sessionId
    );


  if (
    fs.existsSync(dir)
  ) {

    fs.rmSync(
      dir,
      {
        recursive: true,
        force: true
      }
    );

  }


  writeIndex(
    userId,
    ids.filter(
      id =>
        id !== sessionId
    )
  );


  return true;
}


// ============================================================
// MESSAGES
// ============================================================

function getMessages(
  userId,
  sessionId
) {

  if (!sessionId) {
    return [];
  }


  const messages =
    readJSON(
      path.join(
        sessionDir(
          userId,
          sessionId
        ),
        'messages.json'
      ),
      []
    );


  return Array.isArray(messages)
    ? messages
    : [];
}


function appendMessage(
  userId,
  sessionId,
  message
) {

  if (!sessionId) {
    return null;
  }


  const file =
    path.join(
      sessionDir(
        userId,
        sessionId
      ),
      'messages.json'
    );


  const messages =
    getMessages(
      userId,
      sessionId
    );


  const entry = {

    ...message,

    id:
      Date.now() +
      '-' +
      Math.random()
        .toString(36)
        .slice(2, 8),

    ts:
      new Date().toISOString()

  };


  messages.push(entry);


  // Keep maximum 500 messages
  if (
    messages.length > 500
  ) {

    messages.splice(
      0,
      messages.length - 500
    );

  }


  writeJSON(
    file,
    messages
  );


  const meta =
    getSession(
      userId,
      sessionId
    );


  if (meta) {

    meta.msgCount =
      messages.length;

    meta.lastActivity =
      entry.ts;


    writeJSON(
      path.join(
        sessionDir(
          userId,
          sessionId
        ),
        'meta.json'
      ),
      meta
    );

  }


  return entry;
}


// ============================================================
// CLEAR MESSAGES
// ============================================================

function clearMessages(
  userId,
  sessionId
) {

  if (!sessionId) {
    return;
  }


  writeJSON(
    path.join(
      sessionDir(
        userId,
        sessionId
      ),
      'messages.json'
    ),
    []
  );


  const meta =
    getSession(
      userId,
      sessionId
    );


  if (meta) {

    meta.msgCount =
      0;

    meta.lastActivity =
      new Date().toISOString();


    writeJSON(
      path.join(
        sessionDir(
          userId,
          sessionId
        ),
        'meta.json'
      ),
      meta
    );

  }

}


// ============================================================
// USERS
// ============================================================

function listUsers() {

  ensureDir(DATA_DIR);


  return fs
    .readdirSync(
      DATA_DIR,
      {
        withFileTypes: true
      }
    )
    .filter(
      item =>
        item.isDirectory()
    )
    .map(
      item =>
        item.name
    );

}


function deleteUser(userId) {

  const dir =
    userDir(userId);


  if (
    fs.existsSync(dir)
  ) {

    fs.rmSync(
      dir,
      {
        recursive: true,
        force: true
      }
    );

  }

}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {

  // General
  userExists: (userId) =>
    fs.existsSync(
      userDir(userId)
    ),

  // Profile
  getProfile,
  saveProfile,

  // Memory
  getMemory,
  addMemory,
  updateMemory,
  clearMemory,

  // Sessions
  migrateLegacy,
  listSessions,
  getSession,
  createSession,
  touchSession,
  deleteSession,

  // Messages
  getMessages,
  appendMessage,
  clearMessages,

  // Users
  listUsers,
  deleteUser

};