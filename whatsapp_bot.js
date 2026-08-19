const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const { chatStream, ping } = require('./ollama');

const {
  buildSystemPrompt,
  buildMessages
} = require('./prompts');

const {
  getProfile,
  saveProfile,
  getMemory,
  updateMemory,
  createSession,
  listSessions,
  getMessages,
  appendMessage
} = require('./storage');

const {
  extractMemories
} = require('./memoryExtractor');

const {
  getSmartReply
} = require('./smartReplies');


// ============================================================
// CONFIG
// ============================================================

const client = new Client({

  authStrategy: new LocalAuth(),

  puppeteer: {
    headless: true,

    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ]
  }

});


// ============================================================
// RUNTIME STATE
// ============================================================

const processedMessages = new Set();
const processingUsers = new Set();

const lastGoodbye = new Map();


// ============================================================
// QR CODE
// ============================================================

client.on('qr', (qr) => {

  console.log('\n======================================');
  console.log('📱 SCAN THIS QR CODE IN WHATSAPP');
  console.log('======================================\n');

  qrcode.generate(qr, {
    small: true
  });

});


// ============================================================
// AUTHENTICATED
// ============================================================

client.on('authenticated', () => {

  console.log('🔐 WhatsApp authenticated');

});


// ============================================================
// READY
// ============================================================

client.on('ready', async () => {

  console.log('\n======================================');
  console.log('✅ LASYA WHATSAPP BOT IS READY');
  console.log('📱 Waiting for incoming messages...');
  console.log('======================================\n');

  try {

    const status = await ping();

    console.log(
      `🤖 Ollama: ${status.available ? 'CONNECTED' : 'NOT AVAILABLE'}`
    );

    console.log(
      `🧠 Model: ${status.model}`
    );

    console.log(
      `🌐 Host: ${status.host}\n`
    );

  } catch (err) {

    console.error(
      '⚠️ Could not check Ollama:',
      err.message
    );

  }

});


// ============================================================
// DISCONNECTED
// ============================================================

client.on('disconnected', (reason) => {

  console.log(
    '❌ WhatsApp disconnected:',
    reason
  );

});


// ============================================================
// CHANGE STATE
// ============================================================

client.on('change_state', (state) => {

  console.log(
    '📡 WhatsApp state:',
    state
  );

});


// ============================================================
// MESSAGE ID
// ============================================================

function getMessageId(msg) {

  if (msg.id?._serialized) {
    return msg.id._serialized;
  }

  if (
    msg.id?.remote &&
    msg.id?.id
  ) {

    return [
      msg.id.remote,
      msg.id.id
    ].join('_');

  }

  if (
    msg.timestamp &&
    msg.from &&
    msg.body
  ) {

    return [
      msg.timestamp,
      msg.from,
      msg.body
    ].join('_');

  }

  return null;
}


// ============================================================
// MARK MESSAGE PROCESSED
// ============================================================

function markProcessed(id) {

  processedMessages.add(id);

  if (
    processedMessages.size > 500
  ) {

    const first =
      processedMessages
        .values()
        .next()
        .value;

    processedMessages.delete(first);

  }

}


// ============================================================
// USER SESSION
// ============================================================

function getOrCreateSession(userId) {

  const sessions =
    listSessions(userId);

  if (
    sessions &&
    sessions.length
  ) {

    return sessions[0].id;

  }

  const session =
    createSession(
      userId,
      {
        title: 'WhatsApp Chat'
      }
    );

  return session.id;
}


// ============================================================
// MAIN MESSAGE HANDLER
// ============================================================

client.on('message', async (msg) => {

  try {

    console.log('\n🔥 MESSAGE EVENT FIRED');


    // ========================================================
    // IGNORE STATUS / GROUPS / BROADCAST
    // ========================================================

    if (msg.isStatus) {
      return;
    }

    if (
      msg.from &&
      msg.from.includes('@g.us')
    ) {
      return;
    }

    if (msg.broadcast) {
      return;
    }


    // ========================================================
    // MESSAGE TEXT
    // ========================================================

    const text =
      String(
        msg.body || ''
      ).trim();

    if (!text) {
      return;
    }


    // ========================================================
    // USER ID
    // ========================================================

    const userId =
      String(
        msg.from || ''
      );

    if (!userId) {
      return;
    }


    console.log(
      `👤 From: ${userId}`
    );

    console.log(
      `💬 Message: ${text}`
    );


    // ========================================================
    // DUPLICATE PROTECTION
    // ========================================================

    const messageId =
      getMessageId(msg);

    if (!messageId) {

      console.log(
        '⚠️ Message has no usable ID'
      );

      return;

    }

    if (
      processedMessages.has(messageId)
    ) {

      console.log(
        '⏭️ Duplicate message ignored'
      );

      return;

    }

    markProcessed(messageId);


    // ========================================================
    // ONE MESSAGE AT A TIME PER USER
    // ========================================================

    if (
      processingUsers.has(userId)
    ) {

      console.log(
        '⏳ This user is already being processed'
      );

      return;

    }

    processingUsers.add(userId);


    try {

      // ======================================================
      // PROFILE
      // ======================================================

      let profile =
        getProfile(userId);

      const detectedName =
        msg._data?.notifyName ||
        msg._data?.pushname ||
        'Adarsha';


      if (!profile) {

        profile = {

          name: detectedName,

          character: 'Lasya',

          score: 0

        };

      } else {

        profile.name =
          profile.name ||
          detectedName;

      }


      saveProfile(
        userId,
        profile
      );


      const userName =
        profile.name ||
        'Adarsha';


      console.log(
        `👤 Name: ${userName}`
      );


      // ======================================================
      // LOAD USER MEMORY
      // ======================================================

      const memoryData =
        getMemory(userId);

      const memory =
        Array.isArray(
          memoryData?.facts
        )
          ? memoryData.facts
          : [];


      console.log(
        `🧠 Memory: ${memory.length} facts`
      );


      // ======================================================
      // LOAD USER SESSION
      // ======================================================

      const sessionId =
        getOrCreateSession(
          userId
        );


      console.log(
        `💬 Session: ${sessionId}`
      );


      // ======================================================
      // LOAD CONVERSATION HISTORY
      // ======================================================

      const storedMessages =
        getMessages(
          userId,
          sessionId
        );


      const history =
        storedMessages
          .slice(-20)
          .map(item => ({

            role:
              item.role === 'assistant'
                ? 'assistant'
                : 'user',

            content:
              String(
                item.content || ''
              ).trim()

          }))
          .filter(
            item =>
              item.content
          );


      console.log(
        `📚 History: ${history.length} messages`
      );


      // ======================================================
      // BUILD SYSTEM PROMPT
      // ======================================================

      const systemPrompt =
        buildSystemPrompt({

          character: {
            name: 'Lasya'
          },

          userName,

          memory

        });


      // ======================================================
      // BUILD OLLAMA MESSAGES
      // ======================================================

      const messages =
        buildMessages(
          systemPrompt,
          history,
          text
        );


      console.log(
        `🧠 Ollama context: ${messages.length} messages`
      );


      // ======================================================
      // SMART REPLY FIRST
      // ======================================================

      let reply =
        getSmartReply(
          text,
          memory
        );


      if (reply) {

        console.log(
          `🧠 Smart reply: ${reply}`
        );

      } else {

        // ====================================================
        // NORMAL CONVERSATION → OLLAMA
        // ====================================================

        console.log(
          '🤖 Sending message to Ollama...'
        );


        reply =
          await chatStream({
            messages
          });

      }


      // ======================================================
      // CHECK RESPONSE
      // ======================================================

      if (
        !reply ||
        !reply.trim()
      ) {

        console.log(
          '⚠️ Empty reply'
        );

        return;

      }


      const cleanReply =
        reply.trim();


      console.log(
        `🤖 Lasya: ${cleanReply}`
      );


      // ======================================================
      // SAVE USER MESSAGE
      // ======================================================

      appendMessage(
        userId,
        sessionId,
        {
          role: 'user',
          content: text
        }
      );


      // ======================================================
      // SAVE ASSISTANT MESSAGE
      // ======================================================

      appendMessage(
        userId,
        sessionId,
        {
          role: 'assistant',
          content: cleanReply
        }
      );


      // ======================================================
      // SEND WHATSAPP REPLY
      // ======================================================

      await msg.reply(
        cleanReply
      );


      console.log(
        '✅ REPLY SENT SUCCESSFULLY!'
      );


      // ======================================================
      // AUTOMATIC MEMORY EXTRACTION
      // ======================================================

      setImmediate(
        async () => {

          try {

            const newMemories =
              await extractMemories(
                text,
                cleanReply
              );


            if (
              !newMemories.length
            ) {

              console.log(
                '🧠 No new memory'
              );

              return;

            }


            // =================================================
            // IMPORTANT:
            // Use updateMemory(), not addMemory()
            //
            // This allows a changed preference such as:
            //
            // blue → red
            //
            // to replace the old preference.
            // =================================================

            for (
              const fact of newMemories
            ) {

              updateMemory(
                userId,
                fact
              );


              console.log(
                `🧠 Learned/updated for ${userId}: ${fact}`
              );

            }

          } catch (memoryError) {

            console.error(
              '🧠 Memory error:',
              memoryError.message
            );

          }

        }
      );


    } finally {

      processingUsers.delete(
        userId
      );

    }


  } catch (error) {

    console.error(
      '\n❌ WhatsApp message error:',
      error
    );


    try {

      await msg.reply(
        'Umm wait 😭 something went wrong.'
      );

    } catch (replyError) {

      console.error(
        '❌ Could not send error message:',
        replyError.message
      );

    }

  }

});


// ============================================================
// START BOT
// ============================================================

console.log(
  '\n🚀 Starting Lasya WhatsApp Bot...'
);


client.initialize();