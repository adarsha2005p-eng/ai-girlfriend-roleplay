// ============================================================
// OLLAMA CLIENT — LASYA WHATSAPP BOT
// ============================================================

let HOST =
  process.env.OLLAMA_HOST ||
  'http://127.0.0.1:11434';

let MODEL =
  process.env.OLLAMA_MODEL ||
  'llama3.1:8b';


// ============================================================
// MODEL SETTINGS
// ============================================================

function setModel(name) {

  if (
    typeof name === 'string' &&
    name.trim()
  ) {
    MODEL = name.trim();
  }

}


function getModel() {
  return MODEL;
}


function getHost() {
  return HOST;
}


// ============================================================
// CLEAN NORMAL CHAT REPLY
// ============================================================

function cleanAiReply(reply) {

  if (!reply) {
    return 'Hmm 😅';
  }


  let text =
    String(reply).trim();


  // Remove surrounding quotes
  text =
    text
      .replace(/^["']|["']$/g, '')
      .trim();


  // Remove accidental AI-style phrases
  const unwantedPhrases = [

    /As an AI companion,?/gi,
    /As an AI,?/gi,
    /As an artificial intelligence,?/gi,
    /As a digital entity,?/gi,
    /As a digital assistant,?/gi,

    /I am an AI companion,?/gi,
    /I'm an AI companion,?/gi,

    /As a language model,?/gi,
    /I am a language model,?/gi,
    /I'm a language model,?/gi

  ];


  for (const regex of unwantedPhrases) {

    text =
      text.replace(
        regex,
        ''
      );

  }


  // Normalize excessive whitespace
  text =
    text
      .replace(/\s+/g, ' ')
      .trim();


  // Remove accidental role prefixes
  text =
    text
      .replace(
        /^(assistant|lasya)\s*:\s*/i,
        ''
      )
      .trim();


  // Prevent huge WhatsApp replies
  if (text.length > 300) {

    text =
      text
        .slice(0, 300)
        .replace(/\s\S*$/, '')
        .trim() + '...';

  }


  return text || 'Hmm 😅';
}


// ============================================================
// NORMAL CHAT
// ============================================================

async function chatStream({
  messages,
  onToken,
  signal
}) {

  const url =
    `${HOST}/api/chat`;


  try {

    const response =
      await fetch(
        url,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json'
          },

          body: JSON.stringify({

            model: MODEL,

            messages:
              messages.map(
                message => ({
                  role:
                    message.role,

                  content:
                    message.content
                })
              ),

            stream: false,

            options: {

              // Balanced creativity
              temperature: 0.7,

              // Focused responses
              top_p: 0.9,

              // Reduce repeated phrases
              repeat_penalty: 1.15,

              // WhatsApp-sized generation
              num_predict: 50

            }

          }),

          signal
        }
      );


    if (!response.ok) {

      const errorText =
        await response
          .text()
          .catch(() => '');


      throw new Error(
        `Ollama returned ${response.status}: ${errorText}`
      );

    }


    const data =
      await response.json();


    let reply =
      data?.message?.content || '';


    reply =
      cleanAiReply(reply);


    if (
      onToken &&
      reply
    ) {

      onToken(reply);

    }


    return reply;

  } catch (error) {

    console.error(
      '[ollama] chatStream failed:',
      error.message
    );

    throw error;

  }

}


// ============================================================
// INTERNAL CHAT
// Used for memory extraction
// ============================================================

async function chatOnce({
  messages,
  temperature = 0.1
}) {

  try {

    const response =
      await fetch(
        `${HOST}/api/chat`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json'
          },

          body: JSON.stringify({

            model: MODEL,

            messages:
              messages.map(
                message => ({
                  role:
                    message.role,

                  content:
                    message.content
                })
              ),

            stream: false,

            options: {

              // Very low creativity because
              // memory extraction needs accuracy
              temperature,

              top_p: 0.9,

              repeat_penalty: 1.05,

              // Enough room for JSON
              num_predict: 200

            }

          })

        }
      );


    if (!response.ok) {

      throw new Error(
        `Ollama error ${response.status}`
      );

    }


    const data =
      await response.json();


    // IMPORTANT:
    // Return raw text here.
    // Do NOT run cleanAiReply().
    //
    // memoryExtractor.js needs the original
    // JSON response.

    return (
      data?.message?.content || ''
    ).trim();


  } catch (error) {

    console.error(
      '[ollama] chatOnce failed:',
      error.message
    );

    return '';

  }

}


// ============================================================
// PING OLLAMA
// ============================================================

async function ping() {

  try {

    const response =
      await fetch(
        `${HOST}/api/tags`
      );


    if (!response.ok) {

      return {

        ok: false,

        host: HOST,

        model: MODEL,

        available: false

      };

    }


    const data =
      await response.json();


    const models =
      Array.isArray(
        data.models
      )
        ? data.models
        : [];


    const available =
      models.some(
        model =>

          model.name === MODEL ||

          model.name?.startsWith(
            MODEL.split(':')[0]
          )
      );


    return {

      ok: true,

      host: HOST,

      model: MODEL,

      available

    };

  } catch (error) {

    return {

      ok: false,

      host: HOST,

      model: MODEL,

      available: false

    };

  }

}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {

  get MODEL() {
    return MODEL;
  },

  chatStream,

  chatOnce,

  ping,

  setModel,

  getModel,

  getHost

};