// L'aiutante che apre e chiude Chrome per le prove (tests/lib/chrome.js): chiudi() deve tornare
// anche quando il browser è già morto per un segnale, altrimenti la prova che lo usa non esce più.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

test('chiudi() torna anche se il browser è già stato ucciso da un segnale', { skip: process.platform === 'win32' && 'la prova usa un programma finto con #!' }, async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wdm-agent-chrome-prova-'));
  const finto = path.join(tmp, 'browser-finto');
  // Un programma che ignora gli argomenti e resta acceso, come un browser.
  fs.writeFileSync(finto, `#!${process.execPath}\nsetTimeout(() => {}, 60000);\n`, { mode: 0o755 });
  const prima = process.env.WDM_AGENT_CHROME;
  process.env.WDM_AGENT_CHROME = finto;
  try {
    const browser = require('./lib/chrome').apri('about:blank');
    process.kill(browser.pid, 'SIGKILL');
    await new Promise((resolve) => setTimeout(resolve, 300));
    const esito = await Promise.race([browser.chiudi().then(() => 'chiuso'), new Promise((resolve) => setTimeout(() => resolve('fermo'), 3000))]);
    assert.equal(esito, 'chiuso');
  } finally {
    if (prima === undefined) delete process.env.WDM_AGENT_CHROME; else process.env.WDM_AGENT_CHROME = prima;
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
