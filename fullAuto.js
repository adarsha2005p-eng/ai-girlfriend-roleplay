const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');


// ============================================================
// LASYA FULL AUTOMATION RUNNER
// ============================================================
//
// Flow:
//
// 1. Check Ollama
// 2. Run current 70-test suite
// 3. If already 100%, stop
// 4. Run autoImprove.js
// 5. Run final 70-test verification
// 6. Save final status
// 7. Show Windows notification
//
// ============================================================


// ============================================================
// CONFIG
// ============================================================

const ROOT_DIR = __dirname;

const TEST_FILE =
  path.join(ROOT_DIR, 'testAgent.js');

const IMPROVER_FILE =
  path.join(ROOT_DIR, 'autoImprove.js');

const RESULTS_DIR =
  path.join(ROOT_DIR, 'test-results');

const FINAL_STATUS_FILE =
  path.join(
    RESULTS_DIR,
    'automation-status.json'
  );

const MAX_IMPROVER_TIME =
  60 * 60 * 1000; // 1 hour


// ============================================================
// DIRECTORIES
// ============================================================

fs.mkdirSync(
  RESULTS_DIR,
  {
    recursive: true
  }
);


// ============================================================
// HELPERS
// ============================================================

function runNode(
  file,
  timeout = MAX_IMPROVER_TIME
) {

  console.log('');
  console.log(
    `▶ Running ${path.basename(file)}`
  );
  console.log('');

  const result =
    spawnSync(
      process.execPath,
      [file],
      {
        cwd: ROOT_DIR,
        encoding: 'utf8',
        timeout,
        stdio: 'inherit'
      }
    );

  return result;
}


function readJson(file) {

  if (
    !fs.existsSync(file)
  ) {

    return null;

  }

  try {

    return JSON.parse(
      fs.readFileSync(
        file,
        'utf8'
      )
    );

  } catch {

    return null;

  }

}


// ============================================================
// WINDOWS NOTIFICATION
// ============================================================

function notifyWindows(
  title,
  message
) {

  try {

    const escapedTitle =
      title
        .replace(/'/g, "''");

    const escapedMessage =
      message
        .replace(/'/g, "''");


    const ps = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$notify = New-Object System.Windows.Forms.NotifyIcon
$notify.Icon = [System.Drawing.SystemIcons]::Information
$notify.Visible = $true
$notify.BalloonTipTitle = '${escapedTitle}'
$notify.BalloonTipText = '${escapedMessage}'
$notify.ShowBalloonTip(10000)

Start-Sleep -Seconds 11

$notify.Dispose()
`;


    spawnSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        ps
      ],
      {
        windowsHide: true,
        stdio: 'ignore'
      }
    );

  } catch (error) {

    console.log(
      '⚠️ Windows notification failed.'
    );

  }

}


// ============================================================
// SAVE STATUS
// ============================================================

function saveStatus(status) {

  fs.writeFileSync(

    FINAL_STATUS_FILE,

    JSON.stringify(
      {
        timestamp:
          new Date().toISOString(),

        ...status

      },
      null,
      2
    ),

    'utf8'

  );

}


// ============================================================
// PRINT REPORT
// ============================================================

function printReport(
  label,
  report
) {

  if (!report) {

    console.log(
      `${label}: No report available`
    );

    return;

  }


  console.log('');
  console.log(
    '========================================'
  );

  console.log(
    `        ${label}`
  );

  console.log(
    '========================================'
  );

  console.log('');

  console.log(
    `Tests:  ${report.totalTests}`
  );

  console.log(
    `Passed: ${report.passed}`
  );

  console.log(
    `Failed: ${report.failed}`
  );

  console.log(
    `Score:  ${report.score}%`
  );

  console.log('');

}


// ============================================================
// CHECK OLLAMA
// ============================================================

async function checkOllama() {

  try {

    const {
      ping
    } = require('./ollama');


    const result =
      await ping();


    console.log(
      '🤖 Ollama status:'
    );

    console.log(
      `   Host: ${result.host}`
    );

    console.log(
      `   Model: ${result.model}`
    );

    console.log(
      `   Server: ${result.ok ? 'ONLINE' : 'OFFLINE'}`
    );

    console.log(
      `   Model available: ${result.available ? 'YES' : 'NO'}`
    );

    console.log('');


    return (
      result.ok &&
      result.available
    );

  } catch (error) {

    console.log(
      `❌ Ollama check failed: ${error.message}`
    );

    return false;

  }

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
    '       🤖 LASYA FULL AUTO SYSTEM'
  );

  console.log(
    '========================================'
  );

  console.log('');

  console.log(
    'Automatic pipeline:'
  );

  console.log(
    'Ollama → Tests → Improver → Tests → Notification'
  );

  console.log('');


  // ==========================================================
  // OLLAMA
  // ==========================================================

  const ollamaReady =
    await checkOllama();


  if (!ollamaReady) {

    saveStatus({

      success:
        false,

      stage:
        'ollama',

      message:
        'Ollama is offline or model is unavailable.'

    });


    notifyWindows(
      'Lasya Automation',
      'Stopped: Ollama is offline or model is unavailable.'
    );


    process.exitCode = 1;

    return;

  }


  // ==========================================================
  // INITIAL TEST
  // ==========================================================

  console.log(
    '========================================'
  );

  console.log(
    '        🔎 INITIAL REGRESSION'
  );

  console.log(
    '========================================'
  );

  console.log('');


  const initialResult =
    runNode(TEST_FILE);


  const initialReport =
    readJson(
      path.join(
        RESULTS_DIR,
        'latest.json'
      )
    );


  if (!initialReport) {

    saveStatus({

      success:
        false,

      stage:
        'initial-test',

      message:
        'testAgent.js did not produce latest.json.'

    });


    notifyWindows(
      'Lasya Automation',
      'Failed: initial regression report was not created.'
    );


    process.exitCode = 1;

    return;

  }


  printReport(
    'INITIAL RESULT',
    initialReport
  );


  // ==========================================================
  // ALREADY PERFECT
  // ==========================================================

  if (
    initialReport.score >= 100
  ) {

    console.log(
      '🎉 Current build is already 100%.'
    );

    console.log(
      'No prompt modification is necessary.'
    );

    console.log('');

    saveStatus({

      success:
        true,

      stage:
        'complete',

      initialScore:
        initialReport.score,

      finalScore:
        initialReport.score,

      totalTests:
        initialReport.totalTests,

      message:
        'Already perfect. No changes made.'

    });


    notifyWindows(
      'Lasya Automation Complete',
      `Already 100% — ${initialReport.totalTests}/${initialReport.totalTests} tests passed.`
    );


    return;

  }


  // ==========================================================
  // AUTO IMPROVEMENT
  // ==========================================================

  console.log(
    '========================================'
  );

  console.log(
    '        🧠 AUTO IMPROVEMENT'
  );

  console.log(
    '========================================'
  );

  console.log('');

  console.log(
    `Starting from ${initialReport.score}%`
  );

  console.log('');


  const improveResult =
    runNode(
      IMPROVER_FILE
    );


  // ==========================================================
  // FINAL TEST
  // ==========================================================

  console.log(
    '========================================'
  );

  console.log(
    '        🔍 FINAL VERIFICATION'
  );

  console.log(
    '========================================'
  );

  console.log('');


  const finalResult =
    runNode(TEST_FILE);


  const finalReport =
    readJson(
      path.join(
        RESULTS_DIR,
        'latest.json'
      )
    );


  if (!finalReport) {

    saveStatus({

      success:
        false,

      stage:
        'final-test',

      initialScore:
        initialReport.score,

      message:
        'Final test did not produce latest.json.'

    });


    notifyWindows(
      'Lasya Automation',
      'Failed: final regression report was not created.'
    );


    process.exitCode = 1;

    return;

  }


  printReport(
    'FINAL RESULT',
    finalReport
  );


  // ==========================================================
  // COMPARE
  // ==========================================================

  const improvement =
    finalReport.score -
    initialReport.score;


  console.log(
    '========================================'
  );

  console.log(
    '             📊 SUMMARY'
  );

  console.log(
    '========================================'
  );

  console.log('');

  console.log(
    `Initial score: ${initialReport.score}%`
  );

  console.log(
    `Final score:   ${finalReport.score}%`
  );

  console.log(
    `Change:        ${improvement >= 0 ? '+' : ''}${improvement}%`
  );

  console.log(
    `Tests:         ${finalReport.totalTests}`
  );

  console.log('');

  console.log(
    `Passed: ${finalReport.passed}/${finalReport.totalTests}`
  );

  console.log(
    `Failed: ${finalReport.failed}/${finalReport.totalTests}`
  );

  console.log('');


  // ==========================================================
  // FINAL STATUS
  // ==========================================================

  let statusMessage;


  if (
    finalReport.score >= 100
  ) {

    statusMessage =
      'Perfect regression score achieved.';

  } else if (
    finalReport.score >
    initialReport.score
  ) {

    statusMessage =
      'Lasya improved, but is not yet perfect.';

  } else if (
    finalReport.score ===
    initialReport.score
  ) {

    statusMessage =
      'No measurable improvement was achieved.';

  } else {

    statusMessage =
      'Score decreased. Best prompt should have been restored.';

  }


  saveStatus({

    success:
      true,

    stage:
      'complete',

    initialScore:
      initialReport.score,

    finalScore:
      finalReport.score,

    improvement,

    totalTests:
      finalReport.totalTests,

    passed:
      finalReport.passed,

    failed:
      finalReport.failed,

    status:
      statusMessage,

    autoImproveExitCode:
      improveResult.status,

    initialTestExitCode:
      initialResult.status,

    finalTestExitCode:
      finalResult.status

  });


  // ==========================================================
  // FINAL MESSAGE
  // ==========================================================

  console.log(
    '========================================'
  );

  console.log(
    '        🏁 AUTOMATION COMPLETE'
  );

  console.log(
    '========================================'
  );

  console.log('');

  console.log(
    `✅ ${statusMessage}`
  );

  console.log('');

  console.log(
    `📊 Final score: ${finalReport.score}%`
  );

  console.log(
    `🧪 Tests: ${finalReport.passed}/${finalReport.totalTests}`
  );

  console.log('');

  console.log(
    `📄 Report: ${path.join(RESULTS_DIR, 'latest.txt')}`
  );

  console.log(
    `📊 JSON:   ${path.join(RESULTS_DIR, 'latest.json')}`
  );

  console.log(
    `📌 Status: ${FINAL_STATUS_FILE}`
  );

  console.log('');

  console.log(
    '🔔 Windows notification sent.'
  );

  console.log('');

  console.log(
    '========================================'
  );

  console.log('');


  // ==========================================================
  // NOTIFICATION
  // ==========================================================

  notifyWindows(

    'Lasya Automation Complete',

    `Final score: ${finalReport.score}% — ${finalReport.passed}/${finalReport.totalTests} tests passed.`

  );

}


// ============================================================
// ERROR HANDLER
// ============================================================

main()
  .catch(error => {

    console.error('');

    console.error(
      '❌ FULL AUTOMATION ERROR'
    );

    console.error(
      error.stack ||
      error.message
    );

    console.error('');


    saveStatus({

      success:
        false,

      stage:
        'error',

      message:
        error.message

    });


    notifyWindows(
      'Lasya Automation Error',
      error.message
    );


    process.exitCode = 1;

  });