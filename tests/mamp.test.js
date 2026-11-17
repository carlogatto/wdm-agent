// skills/fse-theme-setup/scripts/mamp.js, le parti che non toccano la macchina: dove sta PHP,
// come ci si collega al database, come si compone {wp-cli}. La piattaforma è un argomento:
// i percorsi di Windows (spazi, barre rovesciate, lettera di unità) si provano qui, su macOS.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { RADICE } = require('./lib/citati');
const SCRIPT = path.join(RADICE, 'skills', 'fse-theme-setup', 'scripts', 'mamp.js');
const mamp = require(SCRIPT);
const { argomenti, comando } = require(path.join(RADICE, 'shared', 'scripts', 'lib', 'design-md.js'));

describe('mamp.js: percorsi e comandi', () => {
  const CARTELLE = ['php8.3.30', 'php8.5.2', 'php', 'composer', 'php8.4.17', 'php7.4.33', 'php8.10.1', 'browscap.ini'];

  it('cartella di MAMP predefinita per sistema', () => {
    assert.equal(mamp.radiceMamp('darwin'), '/Applications/MAMP');
    assert.equal(mamp.radiceMamp('win32'), 'C:\\MAMP');
  });

  it('PHP su macOS: versioni dalla più recente, il collegamento «php» escluso', () => {
    assert.deepEqual(mamp.candidatiPhp(CARTELLE, '/Applications/MAMP', 'darwin'), [
      '/Applications/MAMP/bin/php/php8.10.1/bin/php',
      '/Applications/MAMP/bin/php/php8.5.2/bin/php',
      '/Applications/MAMP/bin/php/php8.4.17/bin/php',
      '/Applications/MAMP/bin/php/php8.3.30/bin/php',
      '/Applications/MAMP/bin/php/php7.4.33/bin/php',
    ]);
  });

  it('PHP su Windows: php.exe nella radice della cartella della versione', () => {
    assert.deepEqual(mamp.candidatiPhp(['php8.4.27', 'php8.5.12'], 'C:\\MAMP', 'win32'), [
      'C:\\MAMP\\bin\\php\\php8.5.12\\php.exe',
      'C:\\MAMP\\bin\\php\\php8.4.27\\php.exe',
    ]);
    assert.deepEqual(mamp.candidatiPhp(['php8.4.27'], 'D:\\Programmi\\MAMP PRO', 'win32'), ['D:\\Programmi\\MAMP PRO\\bin\\php\\php8.4.27\\php.exe']);
  });

  it('database: socket su macOS, porta 8889 su Windows', () => {
    assert.deepEqual(mamp.connessione('darwin', '/Applications/MAMP'), { host: 'localhost', porta: 0, socket: '/Applications/MAMP/tmp/mysql/mysql.sock' });
    assert.deepEqual(mamp.connessione('win32', 'C:\\MAMP'), { host: '127.0.0.1', porta: 8889, socket: '' });
    assert.equal(mamp.dbHost(mamp.connessione('darwin', '/Applications/MAMP')), 'localhost');
    assert.equal(mamp.dbHost(mamp.connessione('win32', 'C:\\MAMP')), '127.0.0.1:8889');
  });

  it('{wp-cli} su macOS: socket negli argomenti, virgolette solo per i percorsi con spazi', () => {
    const argv = mamp.wpCli({
      php: '/Applications/MAMP/bin/php/php8.4.17/bin/php', ini: null, socket: '/Applications/MAMP/tmp/mysql/mysql.sock',
      phar: '/Users/Mario Rossi/Sites/il sito/wp-cli.phar', sito: '/Users/Mario Rossi/Sites/il sito',
    });
    assert.deepEqual(argv, [
      '/Applications/MAMP/bin/php/php8.4.17/bin/php', '-d', 'memory_limit=512M', '-d', 'display_errors=stderr',
      '-d', 'mysqli.default_socket=/Applications/MAMP/tmp/mysql/mysql.sock',
      '/Users/Mario Rossi/Sites/il sito/wp-cli.phar', '--path=/Users/Mario Rossi/Sites/il sito',
    ]);
    assert.equal(comando(argv), '/Applications/MAMP/bin/php/php8.4.17/bin/php -d memory_limit=512M -d display_errors=stderr -d mysqli.default_socket=/Applications/MAMP/tmp/mysql/mysql.sock "/Users/Mario Rossi/Sites/il sito/wp-cli.phar" "--path=/Users/Mario Rossi/Sites/il sito"');
    assert.deepEqual(argomenti(comando(argv)), argv);
  });

  it('{wp-cli} su Windows: barre in avanti ovunque, php.ini di MAMP PRO con -c, nessun socket', () => {
    const argv = mamp.wpCli({
      php: 'C:\\MAMP\\bin\\php\\php8.4.27\\php.exe', ini: 'C:\\Users\\Public\\Documents\\Appsolute\\MAMPPRO\\conf\\php.ini', socket: '',
      phar: 'C:\\Users\\Mario Rossi\\Sites\\x\\wp-cli.phar', sito: 'C:\\Users\\Mario Rossi\\Sites\\x',
    });
    assert.deepEqual(argv, [
      'C:/MAMP/bin/php/php8.4.27/php.exe', '-d', 'memory_limit=512M', '-d', 'display_errors=stderr',
      '-c', 'C:/Users/Public/Documents/Appsolute/MAMPPRO/conf/php.ini',
      'C:/Users/Mario Rossi/Sites/x/wp-cli.phar', '--path=C:/Users/Mario Rossi/Sites/x',
    ]);
    const riga = comando(argv);
    assert.ok(!riga.includes('\\'), `barre rovesciate nella riga: ${riga}`);
    assert.ok(riga.includes('"C:/Users/Mario Rossi/Sites/x/wp-cli.phar" "--path=C:/Users/Mario Rossi/Sites/x"'));
    assert.deepEqual(argomenti(riga), argv);
  });

  it('php.ini generato da MAMP PRO: solo su Windows', () => {
    assert.equal(mamp.iniDiMampPro('darwin'), null);
    assert.equal(mamp.iniDiMampPro('win32'), 'C:\\Users\\Public\\Documents\\Appsolute\\MAMPPRO\\conf\\php.ini');
  });

  it('nome del database: solo lettere, cifre, trattino e trattino basso', () => {
    for (const nome of ['atelier-db', 'pinco_pallino-db', 'a1']) assert.equal(mamp.nomeDbValido(nome), true, nome);
    for (const nome of ['', 'a b', 'x`; DROP', "l'atelier", 'a.b', 'è']) assert.equal(mamp.nomeDbValido(nome), false, nome);
  });
});

describe('mamp.js: download di wp-cli.phar', () => {
  let tmp, server, url;
  const CONTENUTO = 'finto phar '.repeat(100);

  before(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wdm-agent-mamp-'));
    server = http.createServer((req, res) => {
      if (req.url === '/intero') {
        res.writeHead(200, { 'Content-Length': Buffer.byteLength(CONTENUTO) });
        res.end(CONTENUTO);
      } else if (req.url === '/troncato') {
        // Annuncia tutto il file, ne manda un pezzo e chiude: il download interrotto a metà.
        res.writeHead(200, { 'Content-Length': Buffer.byteLength(CONTENUTO) });
        res.write(CONTENUTO.slice(0, 50), () => res.destroy());
      } else {
        res.writeHead(404);
        res.end('non trovato');
      }
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    url = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('download riuscito: il file arriva intero', async () => {
    const dest = path.join(tmp, 'a b', 'wp-cli.phar');
    fs.mkdirSync(path.dirname(dest));
    await mamp.scarica(`${url}/intero`, dest);
    assert.equal(fs.readFileSync(dest, 'utf8'), CONTENUTO);
    assert.deepEqual(fs.readdirSync(path.dirname(dest)), ['wp-cli.phar']);
  });

  it('download troncato o rifiutato: errore, e nella cartella non resta nulla', async () => {
    for (const caso of ['troncato', 'assente']) {
      const dir = path.join(tmp, caso);
      fs.mkdirSync(dir);
      await assert.rejects(mamp.scarica(`${url}/${caso}`, path.join(dir, 'wp-cli.phar')));
      assert.deepEqual(fs.readdirSync(dir), [], caso);
    }
  });

  it('dopo un download troncato il rilancio riparte da capo e riesce', async () => {
    const dest = path.join(tmp, 'troncato', 'wp-cli.phar');
    await mamp.scarica(`${url}/intero`, dest);
    assert.equal(fs.readFileSync(dest, 'utf8'), CONTENUTO);
  });
});

describe('mamp.js da riga di comando', () => {
  const lancia = (...args) => {
    const r = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
    return { status: r.status, stdout: r.stdout, stderr: r.stderr };
  };

  it('senza argomenti: uso ed exit 2', () => {
    const r = lancia();
    assert.equal(r.status, 2);
    assert.match(r.stderr, /uso:/);
  });

  it('un flag senza valore o sconosciuto: exit 2 con il nome del flag, niente stack', () => {
    for (const args of [['--site'], ['--site', os.tmpdir(), '--db'], ['--boh', 'x']]) {
      const r = lancia(...args);
      assert.equal(r.status, 2, args.join(' '));
      assert.match(r.stderr, new RegExp(args[args.length - 1] === 'x' ? '--boh' : args[args.length - 1]));
      assert.doesNotMatch(r.stderr, /\bat .*\.js:\d+/);
    }
  });

  it('MAMP assente: messaggio semplice ed exit 1, niente stack', () => {
    const r = lancia('--site', os.tmpdir(), '--mamp', path.join(os.tmpdir(), 'wdm-agent-nessun-mamp'));
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stderr, /Installa MAMP PRO/);
    assert.doesNotMatch(r.stderr, /\bat .*\.js:\d+|ENOENT/);
    assert.equal(r.stdout, '');
  });

  it('nome del database non valido: exit 2 prima di toccare qualcosa', () => {
    const r = lancia('--site', os.tmpdir(), '--db', 'a b', '--mamp', path.join(os.tmpdir(), 'wdm-agent-nessun-mamp'));
    assert.equal(r.status, 2, r.stdout + r.stderr);
    assert.match(r.stderr, /--db/);
  });
});
