// Chrome senza interfaccia per le prove che devono guardare un'immagine o un DOM veri. La pagina
// di prova fa il suo lavoro e manda l'esito al server locale della prova: qui si apre e si chiude
// soltanto il browser. Serve solo a chi sviluppa il plugin.
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Il programma: la variabile WDM_AGENT_CHROME, altrimenti i posti in cui Chrome si installa.
function programma() {
  const candidati = [
    process.env.WDM_AGENT_CHROME,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ...['PROGRAMFILES', 'PROGRAMFILES(X86)', 'LOCALAPPDATA'].map((v) => process.env[v] && path.join(process.env[v], 'Google', 'Chrome', 'Application', 'chrome.exe')),
  ];
  return candidati.find((c) => c && fs.existsSync(c)) || null;
}

// null se Chrome c'è, altrimenti il motivo: le prove lo passano a `skip`.
function nonDisponibile() {
  return programma() ? null : 'Chrome non trovato: installa Google Chrome o indica il programma nella variabile WDM_AGENT_CHROME.';
}

// Apre l'indirizzo in un profilo usa e getta. chiudi() ferma il browser e toglie il profilo.
function apri(url) {
  const profilo = fs.mkdtempSync(path.join(os.tmpdir(), 'wdm-agent-chrome-'));
  const figlio = spawn(programma(), ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--mute-audio', '--window-size=1000,800', `--user-data-dir=${profilo}`, url], { stdio: 'ignore' });
  return {
    chiudi: () => new Promise((resolve) => {
      const togli = () => { fs.rmSync(profilo, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); resolve(); };
      if (figlio.exitCode !== null) return togli();
      figlio.once('exit', togli);
      figlio.kill();
    }),
  };
}

module.exports = { nonDisponibile, apri };
