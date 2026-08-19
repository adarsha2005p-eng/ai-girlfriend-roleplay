const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { chatOnce } = require('./ollama');


// ============================================================
// CONFIG
// ============================================================

const ROOT_DIR = __dirname;

const PROMPT_FILE =
  path.join(ROOT_DIR, 'prompts.js');

const TEST_FILE =
  path.join(ROOT_DIR, 'testAgent.js');

const RESULTS_DIR =
  path.join(ROOT_DIR, 'test-results');

const BACKUP_DIR =
  path.join(RESULTS_DIR, 'backups');

const MAX_ROUNDS = 8;


// ============================================================
// DIRECTORIES
// ============================================================

fs.mkdirSync(
  RESULTS_DIR,
  {
    recursive: true
  }
);

fs.mkdirSync(
  BACKUP_DIR,
  {
    recursive: true
  }
);


// ============================================================
// HELPERS
// ============================================================

function timestamp() {

  return new Date()
    .toISOString()
    .replace(/[:.]/g, '-');

}


function read(file) {

  return fs.readFileSync(
    file,
    'utf8'
  );

}


function write(file, content) {

  fs.writeFileSync(
    file,
    content,
    'utf8'
  );

}


function backupPrompts() {

  const file =
    path.join(
      BACKUP_DIR,
      `prompts-${timestamp()}.js`
    );


  fs.copyFileSync(
    PROMPT_FILE,
    file
  );


  return file;

}


// ============================================================
// RUN TESTS
// ============================================================

function runTests() {

  let testOutput = '';


  try {

    testOutput =
      execFileSync(

        process.execPath,

        [TEST_FILE],

        {
          cwd: ROOT_DIR,
          encoding: 'utf8',
          stdio: 'pipe'
        }

      );

  } catch (error) {

    testOutput =
      String(
        error.stdout || ''
      );

  }


  const reportFile =
    path.join(
      RESULTS_DIR,
      'latest.json'
    );


  if (
    !fs.existsSync(reportFile)
  ) {

    throw new Error(
      'testAgent.js did not create latest.json'
    );

  }


  const report =
    JSON.parse(
      read(reportFile)
    );


  return {

    report,

    output:
      testOutput

  };

}


// ============================================================
// PRINT SCORE
// ============================================================

function printScore(
  label,
  report
) {

  console.log(
    `${label}: ${report.score}%`
  );

  console.log(
    `Passed: ${report.passed}/${report.totalTests}`
  );

  console.log(
    `Failed: ${report.failed}/${report.totalTests}`
  );

  console.log('');

}


// ============================================================
// PRINT CATEGORY SCORES
// ============================================================

function printCategories(report) {

  if (
    !report.categories
  ) {

    console.log(
      '⚠️ No category information found.'
    );

    console.log('');

    return;

  }


  console.log(
    'CATEGORY SCORES:'
  );

  console.log('');


  for (
    const [category, data]
    of Object.entries(
      report.categories
    )
  ) {

    const score =
      data.total > 0

        ? Math.round(
            (data.passed / data.total) * 100
          )

        : 0;


    const icon =
      score === 100
        ? '✅'
        : score >= 80
          ? '🟡'
          : '🔴';


    console.log(

      `${icon} ` +
      `${category}: ` +
      `${data.passed}/${data.total} ` +
      `(${score}%)`

    );

  }


  console.log('');

}


// ============================================================
// FIND WEAKEST CATEGORIES
// ============================================================

function getWeakCategories(report) {

  if (
    !report.categories
  ) {

    return [];

  }


  return Object.entries(
    report.categories
  )

    .map(
      ([category, data]) => {

        const score =
          data.total > 0

            ? Math.round(
                (data.passed / data.total) * 100
              )

            : 0;


        return {

          category,

          score,

          passed:
            data.passed,

          total:
            data.total

        };

      }
    )

    .sort(
      (a, b) => {

        if (
          a.score !== b.score
        ) {

          return a.score - b.score;

        }


        return (
          b.total -
          a.total
        );

      }
    );

}


// ============================================================
// ACTUAL PROMPT SECTIONS
// ============================================================
//
// IMPORTANT:
//
// These are the ONLY sections that autoImprove is allowed
// to modify.
//
// "Real World" is a TEST CATEGORY, not a prompt section.
//
// ============================================================

const PROMPT_SECTIONS = [

  'ABSOLUTE OUTPUT RULE',

  'LATEST MESSAGE HAS PRIORITY',

  'ANSWER QUESTIONS DIRECTLY',

  'NO INVENTED SPECIFIC DETAILS',

  'SPECIFIC DETAIL RULE',

  'LASYA\'S OWN ACTIVITY',

  'USER GENDER / ADDRESS',

  'LASYA\'S GENDER',

  'MEMORY',

  'CURRENT PREFERENCE WINS',

  'FOLLOW-UP CONTEXT',

  'PERSONALITY',

  'QUESTIONS ARE OPTIONAL',

  'NO FORCED TOPIC CHANGES',

  'GOODBYE — EXTREMELY IMPORTANT',

  'SLEEP',

  'NO UNSOLICITED ADVICE',

  'ANTI-REPETITION',

  'WHATSAPP STYLE',

  'NATURAL RESPONSES',

  'EMOTIONAL BEHAVIOR',

  'EXAMPLES',

  'FINAL SILENT CHECK'

];


// ============================================================
// CREATE SECTION MARKER
// ============================================================

function sectionMarker(name) {

  return (

    `==================================================\n` +

    `${name}\n` +

    `==================================================`

  );

}


// ============================================================
// EXTRACT PROMPT SECTIONS
// ============================================================

function extractSections(prompt) {

  const sections = {};


  for (
    const name of PROMPT_SECTIONS
  ) {

    const marker =
      sectionMarker(name);


    const start =
      prompt.indexOf(marker);


    if (
      start === -1
    ) {

      continue;

    }


    const contentStart =
      start +
      marker.length;


    let end =
      prompt.length;


    for (
      const nextName of PROMPT_SECTIONS
    ) {

      if (
        nextName === name
      ) {

        continue;

      }


      const nextMarker =
        sectionMarker(nextName);


      const nextIndex =
        prompt.indexOf(
          nextMarker,
          contentStart
        );


      if (
        nextIndex !== -1 &&
        nextIndex < end
      ) {

        end =
          nextIndex;

      }

    }


    sections[name] =
      prompt.slice(
        contentStart,
        end
      ).trim();

  }


  return sections;

}


// ============================================================
// GET REAL PROMPT SECTION NAMES
// ============================================================

function getActualSectionNames(prompt) {

  return Object.keys(
    extractSections(prompt)
  );

}


// ============================================================
// MAP TEST CATEGORY → REAL PROMPT SECTIONS
// ============================================================

function getPreferredSections(category) {

  const map = {

    'Basic Conversation': [

      'WHATSAPP STYLE',

      'NATURAL RESPONSES',

      'PERSONALITY'

    ],


    'Context': [

      'LATEST MESSAGE HAS PRIORITY',

      'FOLLOW-UP CONTEXT',

      'ANSWER QUESTIONS DIRECTLY',

      'NO FORCED TOPIC CHANGES'

    ],


    'Memory': [

      'MEMORY',

      'CURRENT PREFERENCE WINS',

      'FOLLOW-UP CONTEXT'

    ],


    'Hallucination': [

      'NO INVENTED SPECIFIC DETAILS',

      'SPECIFIC DETAIL RULE',

      'LASYA\'S OWN ACTIVITY'

    ],


    'Goodbye': [

      'GOODBYE — EXTREMELY IMPORTANT',

      'SLEEP',

      'LATEST MESSAGE HAS PRIORITY'

    ],


    'Gender': [

      'LASYA\'S GENDER',

      'USER GENDER / ADDRESS'

    ],


    'Emotion': [

      'EMOTIONAL BEHAVIOR',

      'PERSONALITY',

      'NATURAL RESPONSES'

    ],


    'Naturalness': [

      'ANTI-REPETITION',

      'NATURAL RESPONSES',

      'WHATSAPP STYLE',

      'PERSONALITY'

    ],


    'Internal Leakage': [

      'ABSOLUTE OUTPUT RULE',

      'FINAL SILENT CHECK'

    ],


    'Topic Switching': [

      'LATEST MESSAGE HAS PRIORITY',

      'NO FORCED TOPIC CHANGES',

      'FOLLOW-UP CONTEXT'

    ],


    // ========================================================
    // REAL WORLD
    //
    // IMPORTANT:
    // This maps the TEST CATEGORY to REAL prompt sections.
    //
    // It does NOT create a "REAL WORLD" prompt section.
    // ========================================================

    'Real World': [

      'LATEST MESSAGE HAS PRIORITY',

      'ANSWER QUESTIONS DIRECTLY',

      'NO INVENTED SPECIFIC DETAILS',

      'SPECIFIC DETAIL RULE',

      'LASYA\'S OWN ACTIVITY',

      'FOLLOW-UP CONTEXT',

      'MEMORY',

      'CURRENT PREFERENCE WINS',

      'NO FORCED TOPIC CHANGES',

      'EMOTIONAL BEHAVIOR',

      'NATURAL RESPONSES',

      'WHATSAPP STYLE'

    ]

  };


  return (
    map[category] ||
    []
  );

}


// ============================================================
// FIND FAILED TESTS
// ============================================================

function getFailedTests(report) {

  if (
    !Array.isArray(report.results)
  ) {

    return [];

  }


  return report.results
    .filter(
      result =>
        result &&
        result.passed === false
    );

}


// ============================================================
// BUILD FAILURE SUMMARY
// ============================================================

function buildFailureSummary(report) {

  const failed =
    getFailedTests(report);


  if (
    failed.length === 0
  ) {

    return 'No failed tests.';

  }


  return failed
    .slice(0, 12)
    .map(
      test => {

        const conversation =
          Array.isArray(test.messages)

            ? test.messages
                .map(
                  item =>
                    `USER: ${item.user}\nLASYA: ${item.lasya}`
                )
                .join('\n')

            : 'No conversation data.';


        return (

          `TEST: ${test.name}\n` +

          `CATEGORY: ${test.category}\n` +

          conversation

        );

      }
    )
    .join('\n\n');

}


// ============================================================
// ASK OLLAMA FOR IMPROVEMENT
// ============================================================

async function askForImprovement(
  prompt,
  report,
  attemptedSections
) {

  const sections =
    extractSections(prompt);


  const weakCategories =
    getWeakCategories(report);


  const weakest =
    weakCategories.length > 0
      ? weakCategories[0]
      : null;


  if (
    !weakest
  ) {

    return {

      should_change:
        false,

      section:
        '',

      reason:
        'No category information available',

      replacement:
        ''

    };

  }


  // ==========================================================
  // ONLY REAL SECTIONS FROM prompts.js
  // ==========================================================

  const preferredSections =
    getPreferredSections(
      weakest.category
    );


  const availablePreferred =
    preferredSections.filter(
      section =>

        Object.prototype.hasOwnProperty.call(
          sections,
          section
        ) &&

        !attemptedSections.has(
          section
        )

    );


  let candidateSections =
    availablePreferred;


  // ----------------------------------------------------------
  // If all preferred sections were already attempted,
  // use any remaining REAL section.
  // ----------------------------------------------------------

  if (
    candidateSections.length === 0
  ) {

    candidateSections =
      Object.keys(
        sections
      ).filter(
        section =>
          !attemptedSections.has(
            section
          )
      );

  }


  if (
    candidateSections.length === 0
  ) {

    return {

      should_change:
        false,

      section:
        '',

      reason:
        'No unused real prompt sections remain',

      replacement:
        ''

    };

  }


  const sectionSummary =
    candidateSections
      .map(
        name =>
          `### ${name}\n${sections[name]}`
      )
      .join('\n\n');


  const failureSummary =
    buildFailureSummary(
      report
    );


  const request = `

You are a highly conservative prompt optimizer for a WhatsApp-style conversational character.

CURRENT REGRESSION SCORE:
${report.score}%

TOTAL TESTS:
${report.totalTests}

PASSED:
${report.passed}

FAILED:
${report.failed}


CURRENT CATEGORY RESULTS:

${weakCategories
  .map(
    item =>
      `- ${item.category}: ${item.passed}/${item.total} (${item.score}%)`
  )
  .join('\n')}


WEAKEST TEST CATEGORY:

${weakest.category}

CATEGORY SCORE:

${weakest.score}%


FAILED TEST EXAMPLES:

${failureSummary}


IMPORTANT DISTINCTION:

"${weakest.category}" is a TEST CATEGORY.

It is NOT necessarily a section inside prompts.js.

Only choose a section from the EXACT list below:

${candidateSections.join('\n')}


CURRENT CONTENT OF AVAILABLE PROMPT SECTIONS:

${sectionSummary}


YOUR TASK:

Propose ONE small, targeted improvement that can realistically help the failed tests.

The goal is to improve the weakest test category while preserving all existing passing behavior.


STRICT RULES:

1. Make exactly ONE targeted improvement.
2. Choose exactly ONE section.
3. The section name MUST exactly match one of the available section names.
4. Never return a test category as the section.
5. Never return "Real World" as a section unless it literally appears in the available section list.
6. Preserve existing successful behavior.
7. Do not rewrite the entire prompt.
8. Do not modify JavaScript.
9. Do not modify testAgent.js.
10. Do not modify autoImprove.js.
11. Do not modify memory architecture.
12. Do not remove safety rules.
13. Do not weaken hallucination prevention.
14. Do not invent user facts.
15. Do not invent Lasya activities.
16. Do not weaken latest-message priority.
17. Do not weaken gender rules.
18. Do not weaken goodbye rules.
19. Do not weaken memory rules.
20. Do not force unnecessary questions.
21. Do not force the conversation to continue.
22. Do not introduce random songs, movies, foods, people, places or events.
23. Do not add specific personal facts.
24. Keep the change small.
25. Preserve the original meaning of the selected section.
26. The replacement must contain ONLY the section's contents.
27. Do not include the section title.
28. Do not include section markers.
29. Do not include Markdown code fences.
30. Do not include JavaScript.
31. Do not include JSON inside replacement.
32. Do not include "REAL WORLD" as a fabricated prompt section.
33. If the current prompt is already good enough, return should_change=false.
34. If no safe improvement is possible, return should_change=false.


VERY IMPORTANT:

The regression score is not the only signal.

Look at the actual failed test conversations.

For example, if a test fails because a follow-up "ky?" does not acknowledge the previous emotional statement, improve the relevant context/emotional instruction.

If a test fails because an unknown song was invented, strengthen the relevant hallucination instruction.

Do not make a random stylistic change.


RETURN ONLY VALID JSON.

Required format:

{
  "should_change": true,
  "section": "EXACT REAL PROMPT SECTION NAME",
  "reason": "short explanation",
  "replacement": "complete replacement contents"
}

OR:

{
  "should_change": false,
  "section": "",
  "reason": "No safe measurable improvement is necessary",
  "replacement": ""
}

`;


  const result =
    await chatOnce({

      messages: [

        {

          role:
            'system',

          content:
            'You are a conservative prompt optimizer. Return ONLY valid JSON.'

        },

        {

          role:
            'user',

          content:
            request

        }

      ],

      temperature:
        0.05

    });


  if (
    !result
  ) {

    return {

      should_change:
        false,

      section:
        '',

      reason:
        'No response from Ollama',

      replacement:
        ''

    };

  }


  let cleaned =
    String(result).trim();


  // ==========================================================
  // REMOVE CODE FENCES
  // ==========================================================

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


  // ==========================================================
  // EXTRACT JSON OBJECT
  // ==========================================================

  const first =
    cleaned.indexOf('{');


  const last =
    cleaned.lastIndexOf('}');


  if (
    first === -1 ||
    last === -1 ||
    last <= first
  ) {

    return {

      should_change:
        false,

      section:
        '',

      reason:
        'Ollama did not return a JSON object',

      replacement:
        ''

    };

  }


  cleaned =
    cleaned.slice(
      first,
      last + 1
    );


  try {

    const parsed =
      JSON.parse(
        cleaned
      );


    return {

      should_change:
        parsed.should_change === true,

      section:
        typeof parsed.section === 'string'

          ? parsed.section.trim()

          : '',

      reason:
        typeof parsed.reason === 'string'

          ? parsed.reason.trim()

          : '',

      replacement:
        typeof parsed.replacement === 'string'

          ? parsed.replacement.trim()

          : ''

    };

  } catch (error) {

    return {

      should_change:
        false,

      section:
        '',

      reason:
        'Ollama returned invalid JSON',

      replacement:
        ''

    };

  }

}


// ============================================================
// VALIDATE PROPOSAL
// ============================================================

function validateProposal(
  proposal,
  prompt,
  targetCategory
) {

  if (
    !proposal ||
    !proposal.should_change
  ) {

    return {

      valid:
        false,

      reason:
        proposal?.reason ||
        'No change proposed'

    };

  }


  const sections =
    extractSections(
      prompt
    );


  // ==========================================================
  // EXACT SECTION MATCH
  // ==========================================================

  if (
    !Object.prototype.hasOwnProperty.call(
      sections,
      proposal.section
    )
  ) {

    return {

      valid:
        false,

      reason:
        `Unknown REAL prompt section: ${proposal.section}`

    };

  }


  // ==========================================================
  // NEVER ALLOW TEST CATEGORY AS SECTION
  // ==========================================================

  if (
    proposal.section ===
    targetCategory
  ) {

    return {

      valid:
        false,

      reason:
        `Test category "${targetCategory}" cannot be used as a prompt section`

    };

  }


  if (
    !proposal.replacement
  ) {

    return {

      valid:
        false,

      reason:
        'Replacement is empty'

    };

  }


  if (
    proposal.replacement.length > 5000
  ) {

    return {

      valid:
        false,

      reason:
        'Replacement is too large'

    };

  }


  // ==========================================================
  // FORBIDDEN CONTENT
  // ==========================================================

  const forbidden = [

    'module.exports',

    'require(',

    'chatOnce(',

    'function ',

    'const ',

    'let ',

    'var ',

    'fs.',

    'execFile',

    'child_process',

    '```',

    'prompts.js',

    'testAgent.js',

    'autoImprove.js'

  ];


  for (
    const item of forbidden
  ) {

    if (
      proposal.replacement
        .toLowerCase()
        .includes(
          item.toLowerCase()
        )
    ) {

      return {

        valid:
          false,

        reason:
          `Replacement contains forbidden content: ${item}`

      };

    }

  }


  // ==========================================================
  // DO NOT ALLOW PROMPT SECTION MARKERS
  // ==========================================================

  if (
    proposal.replacement.includes(
      '=================================================='
    )
  ) {

    return {

      valid:
        false,

      reason:
        'Replacement contains section markers'

    };

  }


  // ==========================================================
  // SECTION MUST BE RELEVANT
  // ==========================================================

  const preferred =
    getPreferredSections(
      targetCategory
    );


  if (
    preferred.length > 0 &&
    !preferred.includes(
      proposal.section
    )
  ) {

    return {

      valid:
        false,

      reason:
        `Section "${proposal.section}" is not relevant to ${targetCategory}`

    };

  }


  return {

    valid:
      true,

    reason:
      'Valid'

  };

}


// ============================================================
// REPLACE SECTION
// ============================================================

function replaceSection(
  prompt,
  sectionName,
  replacement
) {

  const marker =
    sectionMarker(
      sectionName
    );


  const start =
    prompt.indexOf(
      marker
    );


  if (
    start === -1
  ) {

    throw new Error(
      `Section not found: ${sectionName}`
    );

  }


  const contentStart =
    start +
    marker.length;


  let end =
    prompt.length;


  for (
    const nextName of PROMPT_SECTIONS
  ) {

    if (
      nextName === sectionName
    ) {

      continue;

    }


    const nextMarker =
      sectionMarker(
        nextName
      );


    const index =
      prompt.indexOf(
        nextMarker,
        contentStart
      );


    if (
      index !== -1 &&
      index < end
    ) {

      end =
        index;

    }

  }


  return (

    prompt.slice(
      0,
      contentStart
    ) +

    '\n\n' +

    replacement.trim() +

    '\n\n' +

    prompt.slice(
      end
    )

  );

}


// ============================================================
// CHECK PROMPT FILE
// ============================================================

function verifyPromptFile() {

  if (
    !fs.existsSync(
      PROMPT_FILE
    )
  ) {

    throw new Error(
      `Prompt file not found: ${PROMPT_FILE}`
    );

  }


  const prompt =
    read(
      PROMPT_FILE
    );


  const sections =
    extractSections(
      prompt
    );


  if (
    Object.keys(sections).length === 0
  ) {

    throw new Error(
      'No valid prompt sections were found in prompts.js'
    );

  }


  console.log(
    `🧩 Detected ${Object.keys(sections).length} prompt sections.`
  );

  console.log('');

}


// ============================================================
// MAIN
// ============================================================

async function main() {

  console.log('');

  console.log(
    '========================================'
  );

  console.log(
    '      🤖 LASYA AUTO IMPROVER v5'
  );

  console.log(
    '========================================'
  );

  console.log('');

  console.log(
    `Maximum rounds: ${MAX_ROUNDS}`
  );

  console.log(
    'Regression suite: AUTOMATIC TEST COUNT'
  );

  console.log('');


  // ==========================================================
  // VERIFY
  // ==========================================================

  verifyPromptFile();


  // ==========================================================
  // BASELINE
  // ==========================================================

  console.log(
    '🔎 Checking baseline...'
  );

  console.log('');


  const baselineResult =
    runTests();


  const baseline =
    baselineResult.report;


  printScore(
    'BASELINE',
    baseline
  );


  printCategories(
    baseline
  );


  let bestScore =
    baseline.score;


  let bestPrompt =
    read(
      PROMPT_FILE
    );


  let bestReport =
    baseline;


  const attemptedSections =
    new Set();


  // ==========================================================
  // ALREADY PERFECT
  // ==========================================================

  if (
    bestScore >= 100
  ) {

    console.log(
      '🟢 Current build is already 100%.'
    );

    console.log(
      'No unnecessary prompt changes will be made.'
    );

    console.log('');

    console.log(
      '========================================'
    );

    console.log(
      '        🏁 AUTO IMPROVEMENT DONE'
    );

    console.log(
      '========================================'
    );

    console.log('');

    console.log(
      `Best score: 100%`
    );

    console.log(
      `Tests: ${baseline.totalTests}/${baseline.totalTests}`
    );

    console.log(
      `Prompt: ${PROMPT_FILE}`
    );

    console.log(
      `Backups: ${BACKUP_DIR}`
    );

    console.log('');

    return;

  }


  // ==========================================================
  // IMPROVEMENT ROUNDS
  // ==========================================================

  for (
    let round = 1;
    round <= MAX_ROUNDS;
    round++
  ) {

    console.log(
      '========================================'
    );

    console.log(
      `        IMPROVEMENT ROUND ${round}`
    );

    console.log(
      '========================================'
    );

    console.log('');


    // --------------------------------------------------------
    // CURRENT WEAKEST CATEGORY
    // --------------------------------------------------------

    const weakCategories =
      getWeakCategories(
        bestReport
      );


    const weakest =
      weakCategories[0];


    if (
      !weakest
    ) {

      console.log(
        '⚠️ Could not determine weakest category.'
      );

      break;

    }


    console.log(
      `🎯 Target test category: ${weakest.category}`
    );

    console.log(
      `Current category score: ${weakest.score}%`
    );

    console.log('');


    // --------------------------------------------------------
    // BACKUP
    // --------------------------------------------------------

    const backup =
      backupPrompts();


    console.log(
      `💾 Backup: ${path.basename(backup)}`
    );

    console.log('');


    // --------------------------------------------------------
    // ASK OLLAMA
    // --------------------------------------------------------

    console.log(
      '🧠 Asking Ollama for ONE targeted improvement...'
    );

    console.log('');


    const proposal =
      await askForImprovement(

        bestPrompt,

        bestReport,

        attemptedSections

      );


    console.log(
      `Section: ${proposal.section || '(none)'}`
    );

    console.log(
      `Reason: ${proposal.reason || '(none)'}`
    );

    console.log('');


    // --------------------------------------------------------
    // NO CHANGE
    // --------------------------------------------------------

    if (
      !proposal.should_change
    ) {

      console.log(
        '🟡 Ollama found no safe improvement.'
      );

      console.log('');

      break;

    }


    // --------------------------------------------------------
    // VALIDATE FIRST
    // --------------------------------------------------------

    const validation =
      validateProposal(

        proposal,

        bestPrompt,

        weakest.category

      );


    if (
      !validation.valid
    ) {

      console.log(
        `⚠️ Proposal rejected: ${validation.reason}`
      );

      console.log(
        '↩️ No changes made.'
      );

      console.log('');

      attemptedSections.add(
        proposal.section ||
        `INVALID-${round}`
      );

      continue;

    }


    // --------------------------------------------------------
    // REMEMBER ATTEMPTED SECTION
    // --------------------------------------------------------

    attemptedSections.add(
      proposal.section
    );


    // --------------------------------------------------------
    // SHOW CHANGE
    // --------------------------------------------------------

    console.log(
      '🔧 Proposed replacement:'
    );

    console.log('');

    console.log(
      proposal.replacement
    );

    console.log('');


    // --------------------------------------------------------
    // APPLY TEMPORARILY
    // --------------------------------------------------------

    let modifiedPrompt;


    try {

      modifiedPrompt =
        replaceSection(

          bestPrompt,

          proposal.section,

          proposal.replacement

        );


      write(
        PROMPT_FILE,
        modifiedPrompt
      );


    } catch (error) {

      console.log(
        `❌ Could not apply: ${error.message}`
      );

      write(
        PROMPT_FILE,
        bestPrompt
      );

      continue;

    }


    console.log(
      '✅ Temporary change applied.'
    );

    console.log('');


    // --------------------------------------------------------
    // REGRESSION TEST
    // --------------------------------------------------------

    console.log(
      `🧪 Running full ${bestReport.totalTests || 'automatic'}-test regression...`
    );

    console.log('');


    let newResult;


    try {

      newResult =
        runTests();

    } catch (error) {

      console.log(
        `❌ Test error: ${error.message}`
      );

      write(
        PROMPT_FILE,
        bestPrompt
      );

      continue;

    }


    const newReport =
      newResult.report;


    printScore(
      'NEW SCORE',
      newReport
    );


    printCategories(
      newReport
    );


    // --------------------------------------------------------
    // ACCEPT ONLY STRICT IMPROVEMENT
    // --------------------------------------------------------

    if (
      newReport.score > bestScore
    ) {

      const previousBest =
        bestScore;


      bestScore =
        newReport.score;


      bestPrompt =
        read(
          PROMPT_FILE
        );


      bestReport =
        newReport;


      console.log(
        '🟢 CHANGE ACCEPTED'
      );

      console.log(
        `Previous best: ${previousBest}%`
      );

      console.log(
        `New best: ${bestScore}%`
      );

      console.log('');

    } else {

      write(
        PROMPT_FILE,
        bestPrompt
      );


      console.log(
        '🔴 CHANGE REJECTED'
      );

      console.log(
        `Best score remains: ${bestScore}%`
      );

      console.log(
        `Proposed score: ${newReport.score}%`
      );

      console.log(
        '↩️ Best prompt restored.'
      );

      console.log('');

    }


    // --------------------------------------------------------
    // STOP IF PERFECT
    // --------------------------------------------------------

    if (
      bestScore >= 100
    ) {

      console.log(
        '🎉 Regression suite reached 100%.'
      );

      console.log(
        'Stopping improvement rounds.'
      );

      console.log('');

      break;

    }

  }


  // ==========================================================
  // FINAL RESTORE
  // ==========================================================

  write(
    PROMPT_FILE,
    bestPrompt
  );


  // ==========================================================
  // FINAL REGRESSION
  // ==========================================================

  console.log(
    '========================================'
  );

  console.log(
    '       🔍 FINAL VERIFICATION'
  );

  console.log(
    '========================================'
  );

  console.log('');


  let finalReport;


  try {

    finalReport =
      runTests().report;

  } catch (error) {

    console.log(
      `⚠️ Final verification failed: ${error.message}`
    );

    finalReport =
      bestReport;

  }


  printScore(
    'FINAL SCORE',
    finalReport
  );


  printCategories(
    finalReport
  );


  // ==========================================================
  // DONE
  // ==========================================================

  console.log(
    '========================================'
  );

  console.log(
    '        🏁 AUTO IMPROVEMENT DONE'
  );

  console.log(
    '========================================'
  );

  console.log('');

  console.log(
    `Best score: ${bestScore}%`
  );

  console.log(
    `Final score: ${finalReport.score}%`
  );

  console.log(
    `Tests: ${finalReport.passed}/${finalReport.totalTests}`
  );

  console.log('');

  console.log(
    `Prompt: ${PROMPT_FILE}`
  );

  console.log('');

  console.log(
    `Backups: ${BACKUP_DIR}`
  );

  console.log('');

  console.log(
    '🟢 Best known prompt restored.'
  );

  console.log('');

}


// ============================================================
// ERROR HANDLER
// ============================================================

main()
  .catch(error => {

    console.error('');

    console.error(
      '❌ AUTO IMPROVER ERROR'
    );

    console.error(
      error.message
    );

    console.error('');

    process.exitCode = 1;

  });