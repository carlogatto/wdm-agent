// shared/scripts/sessione.js senza WordPress: uso, composizione del file da eseguire dai modelli,
// messaggi quando a DESIGN.md manca qualcosa. E l'hook che chiude ciò che resta aperto, nei casi
// in cui WordPress non serve o non risponde. Le prove con una sessione vera stanno in sito/.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { RADICE } = require('./lib/citati');
const SCRIPT = path.join(RADICE, 'shared', 'scripts', 'sessione.js');
const HOOK = path.join(RADICE, 'hooks', 'chiudi-sessione.js');
const MODELLI = path.join(RADICE, 'shared', 'playwright');
const { componi, file } = require(SCRIPT);

const lancia = (...args) => {
  const r = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
  return { status: r.status, out: r.stdout + r.stderr };
};
const hook = (cwd) => {
  const r = spawnSync(process.execPath, [HOOK], { encoding: 'utf8', input: JSON.stringify({ hook_event_name: 'Stop', cwd }) });
  return { status: r.status, out: r.stdout + r.stderr };
};
const sintassi = (testo, tmp) => {
  const f = path.join(tmp, 'composto.js');
  fs.writeFileSync(f, testo);
  return spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
};

describe('sessione.js senza WordPress', () => {
  let tmp;
  // Un progetto FSE la cui riga {wp-cli} non può partire: WordPress «non risponde».
  const progetto = (righe) => {
    const sito = fs.mkdtempSync(path.join(tmp, 'sito-'));
    fs.writeFileSync(path.join(sito, 'DESIGN.md'), ['## Project Config', '### Identity', '| Variable | Value |', '|---|---|', ...righe, ''].join('\n'));
    return sito;
  };
  const COMPLETO = ['| `theme_family` | fse |', '| `{prefix}` | abc |', '| `{local-url}` | https://abc.invalid:8890/ |', '| `{agent-admin-user}` | abcadminclaude |',
    '### Paths', '| Variable | Value |', '|---|---|', '| `{wp-cli}` | /php/che/non/esiste wp-cli.phar |'];

  before(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wdm-agent-sessione-')); });
  after(() => fs.rmSync(tmp, { recursive: true, force: true }));

  it('senza argomenti, o con un comando che non esiste: uso ed exit 2', () => {
    for (const args of [[], ['apri'], ['apri', tmp], ['chiudi'], ['chiudi', tmp, 'in-più'], ['entra', tmp]]) {
      const r = lancia(...args);
      assert.equal(r.status, 2, `${args.join(' ')}: ${r.out}`);
      assert.match(r.out, /uso: node sessione\.js apri/);
    }
  });

  it('componi: cookie al posto di COOKIES, valori al posto dei segnaposto', () => {
    const fatto = componi("async (page) => { await page.context().addCookies(/*COOKIES*/); return '{{local-url}}/x?id={{id}}'; }", { 'local-url': 'https://abc.local:8890', id: '7' }, [{ name: 'a', value: 'b' }]);
    assert.equal(fatto, "async (page) => { await page.context().addCookies([{\"name\":\"a\",\"value\":\"b\"}]); return 'https://abc.local:8890/x?id=7'; }");
  });

  it('componi: un valore con apostrofi, virgolette e barre rovesciate resta la stessa stringa', () => {
    const json = JSON.stringify({ title: 'L\'Atelier "nuovo" \\ fine', text: 'riga\nsotto' });
    const fatto = componi("/*COOKIES*/ JSON.parse('{{attributi}}')", { attributi: json }, []);
    assert.deepEqual(new Function(`return ${fatto.replace('[]', '')}`)(), JSON.parse(json));
  });

  it('componi: un a capo di qualunque tipo resta dentro la stringa; un valore che cita COOKIES non riceve i cookie', () => {
    const fatto = componi("/*COOKIES*/ '{{testo}}'", { testo: 'uno\rdue\r\ntre\nquattro /*COOKIES*/' }, [{ name: 'a' }]);
    assert.equal(fatto, '[{"name":"a"}] \'uno\\ndue\\ntre\\nquattro /*COOKIES*/\'');
  });

  it('componi: un segnaposto senza valore, o un modello senza COOKIES, è un errore che dice cosa fare', () => {
    assert.throws(() => componi("/*COOKIES*/ '{{id}}' '{{blocco}}'", {}, []), /il modello chiede \{\{id\}\}, \{\{blocco\}\}: aggiungi id=valore blocco=valore/);
    assert.throws(() => componi("async (page) => '{{id}}'", { id: 1 }, []), /non ha il segnaposto \/\*COOKIES\*\//);
  });

  it('i modelli del plugin: JavaScript valido prima e dopo la composizione, con i soli segnaposto dichiarati', () => {
    const modelli = fs.readdirSync(MODELLI).filter((f) => f.endsWith('.js'));
    assert.deepEqual(modelli.sort(), ['pw-blocco.js', 'pw-kit.js', 'pw-pagina.js']);
    const valori = { 'local-url': 'https://abc.local:8890', prefix: 'abc', shots: '/tmp/Mario Rossi/shots', id: '7', blocco: 'abc/cta', attributi: '{"title":"L\'Atelier"}',
      url: 'https://localhost:8848/html/abc-home.html', nome: 'kit-home' };
    for (const nome of modelli) {
      const modello = fs.readFileSync(path.join(MODELLI, nome), 'utf8');
      assert.equal(sintassi(modello, tmp).status, 0, `${nome}: non è JavaScript valido così com'è`);
      // Il modello dei kit non entra nel backend: si compone senza cookie.
      const fatto = componi(modello, valori, nome === 'pw-kit.js' ? null : [{ name: 'a', value: 'b', domain: 'abc.local', path: '/' }]);
      assert.doesNotMatch(fatto.replace(/^\s*\/\/.*$/gm, ''), /\{\{|\/\*COOKIES\*\//, nome);
      const esito = sintassi(fatto, tmp);
      assert.equal(esito.status, 0, `${nome}: ${esito.stderr}`);
      assert.doesNotMatch(modello, /\brequire\(|\{password\}|user_pass/, `${nome}: niente require né login con password`);
    }
  });

  // Lotto 7.1: i caroselli partono quando entrano nello schermo. Contati appena caricata la
  // pagina davano 0 a 1440 e a 390 su una pagina con tre caroselli che funzionano.
  it('i modelli scorrono la pagina prima di contare i caroselli, e dicono quanti dovrebbero essercene', () => {
    for (const nome of ['pw-pagina.js', 'pw-kit.js']) {
      const modello = fs.readFileSync(path.join(MODELLI, nome), 'utf8');
      assert.match(modello, /scrollTo\([\s\S]*caroselliAvviati/, `${nome}: conta i caroselli senza aver scorso la pagina`);
      assert.match(modello, /caroselli: /, `${nome}: non dice quanti caroselli ha la pagina`);
    }
  });

  // Lotto 7.1: per guardare un kit (html compilato, servito dall'anteprima) non serve entrare in
  // WordPress. `prepara` compone il file da eseguire senza aprire sessioni.
  it('prepara: scrive _run.js da un modello che non entra nel backend, anche se WordPress non risponde', () => {
    const sito = progetto(COMPLETO);
    const r = lancia('prepara', sito, path.join(MODELLI, 'pw-kit.js'), 'url=https://localhost:8848/html/abc-home.html', 'nome=kit-home');
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /pronto: .*_run\.js/);
    const scritto = fs.readFileSync(file(sito).run, 'utf8');
    assert.ok(scritto.includes("'https://localhost:8848/html/abc-home.html'") && scritto.includes('/shots'), scritto.slice(0, 400));
    assert.ok(!fs.existsSync(file(sito).segno), 'prepara non apre sessioni: nessun segno per l\'hook');
    assert.equal(sintassi(scritto, tmp).status, 0);
  });

  it('prepara con un modello che entra nel backend, o senza un valore: exit 1 con cosa fare, nessun file', () => {
    const sito = progetto(COMPLETO);
    let r = lancia('prepara', sito, path.join(MODELLI, 'pw-pagina.js'), 'id=1');
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /entra nel backend: usa `apri`/);
    r = lancia('prepara', sito, path.join(MODELLI, 'pw-kit.js'), 'nome=kit-home');
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /aggiungi url=valore/);
    assert.ok(!fs.existsSync(file(sito).run));
    assert.equal(lancia('prepara', sito).status, 2);
  });

  it('DESIGN.md assente, di un\'altra famiglia o senza una riga: exit 1 con cosa manca', () => {
    const modello = path.join(MODELLI, 'pw-pagina.js');
    let r = lancia('apri', fs.mkdtempSync(path.join(tmp, 'vuota-')), modello, 'id=1');
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /non c'è DESIGN\.md/);
    r = lancia('apri', progetto(['| `theme_family` | starter |']), modello, 'id=1');
    assert.match(r.out, /non è di un progetto wdm-theme/);
    r = lancia('apri', progetto(COMPLETO.filter((riga) => !riga.includes('agent-admin-user'))), modello, 'id=1');
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /manca la riga `\{agent-admin-user\}`/);
  });

  it('WordPress non risponde: exit 1, «avvia i server di MAMP PRO», nessun file lasciato', () => {
    const sito = progetto(COMPLETO);
    const r = lancia('apri', sito, path.join(MODELLI, 'pw-pagina.js'), 'id=1');
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /avvia i server di MAMP PRO/);
    assert.ok(!fs.existsSync(file(sito).run) && !fs.existsSync(file(sito).segno));
  });

  describe('hook chiudi-sessione', () => {
    const aperta = (sito, scade) => {
      fs.mkdirSync(path.dirname(file(sito).run), { recursive: true });
      fs.writeFileSync(file(sito).run, 'cookie');
      fs.writeFileSync(file(sito).segno, JSON.stringify({ utente: 'abcadminclaude', scade }));
    };
    const ora = Math.floor(Date.now() / 1000);

    it('fuori da un progetto FSE, o senza sessione aperta: esce con 0 in silenzio e non lancia nulla', () => {
      for (const cwd of [fs.mkdtempSync(path.join(tmp, 'altrove-')), progetto(COMPLETO)]) {
        const r = hook(cwd);
        assert.equal(r.status, 0, r.out);
        assert.equal(r.out, '');
      }
    });

    it('sessione già scaduta e WordPress fermo: toglie i file, in silenzio', () => {
      const sito = progetto(COMPLETO);
      aperta(sito, ora - 60);
      const r = hook(path.join(sito, '.playwright-mcp'));
      assert.equal(r.status, 0, r.out);
      assert.equal(r.out, '');
      assert.ok(!fs.existsSync(file(sito).run) && !fs.existsSync(file(sito).segno));
    });

    it('sessione ancora valida e WordPress fermo: non blocca il turno, lo dice, e il segno resta per riprovare', () => {
      const sito = progetto(COMPLETO);
      aperta(sito, ora + 600);
      const r = hook(sito);
      assert.equal(r.status, 0, r.out);
      assert.match(r.out, /non revocata/);
      assert.ok(!fs.existsSync(file(sito).run), 'i cookie sono rimasti su disco');
      assert.ok(fs.existsSync(file(sito).segno), 'senza il segno il prossimo turno non riprova');
    });

    it('ingresso non leggibile: esce con 0', () => {
      const r = spawnSync(process.execPath, [HOOK], { encoding: 'utf8', input: 'non è json', cwd: tmp });
      assert.equal(r.status, 0, r.stdout + r.stderr);
    });
  });
});
