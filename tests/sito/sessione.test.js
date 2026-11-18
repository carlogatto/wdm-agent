// Login senza password (D2) sul sito di prova: sessione.js apre una sessione temporanea per
// l'utente agente e la revoca sempre, anche quando il lavoro si ferma a metà (hook di fine
// turno) o quando è lui stesso a fallire. I casi sono in sequenza.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const sito = require('../lib/sito');
const { RADICE, assoluto } = require('../lib/citati');

const SCRIPT = assoluto('shared/scripts/sessione.js');
const PHP = assoluto('shared/scripts/sessione.php');
const HOOK = path.join(RADICE, 'hooks', 'chiudi-sessione.js');
const MODELLO = path.join(RADICE, 'shared', 'playwright', 'pw-pagina.js');
const UTENTE = 'testadmin';

describe('sessione.js', { skip: sito.nonDisponibile() || false }, () => {
  let cfg, run, segno;

  const lancia = (...args) => {
    const r = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
    return { status: r.status, out: r.stdout + r.stderr };
  };
  const apri = (...args) => lancia('apri', cfg.site, MODELLO, 'id=1', ...args);
  const sessioni = () => {
    const r = sito.wp(['eval-file', PHP, 'stato', UTENTE]);
    assert.equal(r.status, 0, r.out);
    return JSON.parse(r.stdout).sessioni;
  };
  const cookie = () => JSON.parse(/addCookies\((\[.*?\])\);/.exec(fs.readFileSync(run, 'utf8'))[1]);
  // L'ID dell'utente per cui WordPress accetta il cookie, 0 se lo rifiuta.
  const accettato = (c, schema) => {
    assert.match(c.value, /^[A-Za-z0-9|]+$/);
    return Number(sito.wp(['eval', `echo (int) wp_validate_auth_cookie( '${c.value}', '${schema}' );`]).stdout.trim());
  };
  const design = (utente = UTENTE) => fs.writeFileSync(path.join(cfg.site, 'DESIGN.md'), sito.designMd(cfg, { '{agent-admin-user}': utente }));

  before(() => {
    cfg = sito.prepara();
    design();
    run = path.join(cfg.site, '.playwright-mcp', '_run.js');
    segno = path.join(cfg.site, '.playwright-mcp', '_sessione.json');
  });

  after(() => sito.reset());

  it('(a) apri: una sessione, e un file da eseguire con cookie che WordPress accetta', () => {
    assert.equal(sessioni(), 0);
    const r = apri();
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /pronto: .*_run\.js/);
    assert.equal(sessioni(), 1);
    const testo = fs.readFileSync(run, 'utf8');
    assert.doesNotMatch(testo.replace(/^\s*\/\/.*$/gm, ''), /\{\{|\/\*COOKIES\*\//);
    assert.ok(testo.includes(cfg.url.replace(/\/+$/, '')));
    assert.equal(spawnSync(process.execPath, ['--check', run]).status, 0);
    const c = cookie();
    assert.deepEqual(c.map((x) => [/^wordpress_(sec|logged_in)_/.exec(x.name)[1], x.secure, x.httpOnly]), [['sec', true, true], ['sec', true, true], ['logged_in', true, true]]);
    assert.equal(accettato(c[0], 'secure_auth'), 1);
    assert.equal(accettato(c[2], 'logged_in'), 1);
    assert.ok(JSON.parse(fs.readFileSync(segno, 'utf8')).scade > Date.now() / 1000 + 14 * 60);
  });

  it('(b) un secondo apri chiude la sessione di prima: ne resta una, e il cookie vecchio non vale più', () => {
    const vecchio = cookie()[0];
    assert.equal(apri().status, 0);
    assert.equal(sessioni(), 1);
    assert.equal(accettato(vecchio, 'secure_auth'), 0);
    assert.equal(accettato(cookie()[0], 'secure_auth'), 1);
  });

  it('(c) chiudi: 0 sessioni, cookie rifiutato, nessun file lasciato', () => {
    const c = cookie()[0];
    const r = lancia('chiudi', cfg.site);
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /sessioni attive: 0/);
    assert.equal(sessioni(), 0);
    assert.equal(accettato(c, 'secure_auth'), 0);
    assert.ok(!fs.existsSync(run) && !fs.existsSync(segno));
    assert.equal(lancia('chiudi', cfg.site).status, 0, 'chiudi due volte deve restare a 0');
  });

  // Playwright chiude la scheda senza avvisare l'editor: il blocco di modifica dell'utente agente
  // resterebbe valido per altri due minuti e fermerebbe la build successiva (exit 4).
  it('(c2) chiudi toglie i blocchi di modifica lasciati dall\'utente agente, non quelli degli altri', () => {
    const crea = (...args) => sito.wp([...args, '--porcelain']).stdout.trim();
    const altro = crea('user', 'create', 'cliente', 'cliente@example.com', '--role=editor');
    const [mia, sua] = ['Mia', 'Sua'].map((titolo) => crea('post', 'create', '--post_type=page', `--post_title=${titolo}`));
    const ora = Math.floor(Date.now() / 1000);
    sito.wp(['post', 'meta', 'update', mia, '_edit_lock', `${ora}:1`]);
    sito.wp(['post', 'meta', 'update', sua, '_edit_lock', `${ora}:${altro}`]);
    assert.equal(apri().status, 0);
    assert.equal(lancia('chiudi', cfg.site).status, 0);
    assert.equal(sito.wp(['post', 'meta', 'get', mia, '_edit_lock']).stdout.trim(), '');
    assert.equal(sito.wp(['post', 'meta', 'get', sua, '_edit_lock']).stdout.trim(), `${ora}:${altro}`);
  });

  it('(d) apri che non può riuscire (modello assente, segnaposto senza valore): exit 1 e nessuna sessione creata', () => {
    let r = lancia('apri', cfg.site, path.join(cfg.site, 'non-esiste.js'));
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /modello non trovato/);
    r = lancia('apri', cfg.site, MODELLO);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /aggiungi id=valore/);
    assert.equal(sessioni(), 0);
  });

  it('(e) errore dopo la creazione (il file da eseguire non si può scrivere): la sessione viene chiusa', () => {
    const cartella = path.dirname(run);
    fs.rmSync(cartella, { recursive: true, force: true });
    fs.writeFileSync(cartella, 'un file al posto della cartella');
    const r = apri();
    fs.rmSync(cartella);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /La sessione è stata chiusa/);
    assert.equal(sessioni(), 0);
  });

  it('(f) lavoro fermato a metà, senza chiudi: l\'hook di fine turno revoca la sessione', () => {
    assert.equal(apri().status, 0);
    const c = cookie()[0];
    assert.equal(sessioni(), 1);
    // Claude Code passa la cartella di lavoro: le skill stanno spesso dentro il tema.
    const r = spawnSync(process.execPath, [HOOK], { encoding: 'utf8', input: JSON.stringify({ hook_event_name: 'Stop', cwd: path.join(cfg.site, 'wp-content', 'themes') }) });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.equal(r.stdout + r.stderr, '');
    assert.equal(sessioni(), 0);
    assert.equal(accettato(c, 'secure_auth'), 0);
    assert.ok(!fs.existsSync(run) && !fs.existsSync(segno));
  });

  it('(g) utente agente che non esiste in WordPress: exit 1 con cosa fare', () => {
    design('nonesiste');
    const r = apri();
    design();
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /non esiste l'utente «nonesiste»/);
  });

  it('(h) sito in http: cookie `auth`, non `secure`, e WordPress lo accetta', () => {
    const http = cfg.url.replace(/^https:/, 'http:').replace(/\/+$/, '');
    for (const opzione of ['home', 'siteurl']) assert.equal(sito.wp(['option', 'update', opzione, http]).status, 0);
    try {
      assert.equal(apri().status, 0);
      const c = cookie();
      assert.deepEqual(c.map((x) => [/^wordpress_(sec_|logged_in_)?/.exec(x.name)[1] || 'auth', x.secure]), [['auth', false], ['auth', false], ['logged_in_', false]]);
      assert.equal(accettato(c[0], 'auth'), 1);
      assert.equal(lancia('chiudi', cfg.site).status, 0);
      assert.equal(sessioni(), 0);
    } finally {
      for (const opzione of ['home', 'siteurl']) sito.wp(['option', 'update', opzione, cfg.url.replace(/\/+$/, '')]);
    }
  });
});
