// shared/scripts/lib/design-md.js: lettura e scrittura delle righe di DESIGN.md → Project Config,
// e la riga {wp-cli} divisa in argomenti (chi la esegue da Node non passa da una shell) e
// ricomposta (chi la scrive mette le virgolette solo dove servono).
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { valore, eFse, imposta, argomenti, comando } = require(path.join(__dirname, '..', 'shared', 'scripts', 'lib', 'design-md.js'));

const DESIGN = [
  '# Design: prova',
  '',
  '### Identity',
  '| Variable | Value |',
  '|---|---|',
  '| `theme_family` | fse |',
  '| `{prefix}` | abc |',
  '',
  '### Paths',
  '| Variable | Value |',
  '|---|---|',
  '| `{site-root}` | /x/sito |',
  '| `{wp-cli}` | /php -d a=1 /x/sito/wp-cli.phar --path=/x/sito |',
  '',
  '## Local Development',
  'La riga `{wp-cli}` | citata in prosa | non è una riga di tabella.',
  '',
].join('\n');

test('valore legge una riga della tabella, null se manca', () => {
  assert.equal(valore(DESIGN, 'theme_family'), 'fse');
  assert.equal(valore(DESIGN, '{prefix}'), 'abc');
  assert.equal(valore(DESIGN, '{wp-cli}'), '/php -d a=1 /x/sito/wp-cli.phar --path=/x/sito');
  assert.equal(valore(DESIGN, '{db-socket}'), null);
});

test('eFse riconosce solo theme_family fse', () => {
  assert.equal(eFse(DESIGN), true);
  assert.equal(eFse(DESIGN.replace('| fse |', '| starter |')), false);
  assert.equal(eFse('# senza tabella\n'), false);
});

test('imposta sostituisce il valore di una riga esistente, alla lettera', () => {
  const nuovo = imposta(DESIGN, '{wp-cli}', '"/a b/php" $& $1');
  assert.equal(valore(nuovo, '{wp-cli}'), '"/a b/php" $& $1');
  assert.equal(valore(nuovo, '{site-root}'), '/x/sito');
  assert.equal(nuovo.split('\n').length, DESIGN.split('\n').length);
});

test('imposta aggiunge la riga in fondo alla tabella di Paths', () => {
  const righe = imposta(DESIGN, '{db-socket}', '/tmp/mysql.sock').split('\n');
  const i = righe.indexOf('| `{db-socket}` | /tmp/mysql.sock |');
  assert.ok(i > 0, 'riga non aggiunta');
  assert.ok(righe[i - 1].startsWith('| `{wp-cli}`'));
  assert.equal(righe[i + 1], '');
});

test('imposta senza la sezione Paths: errore che dice cosa manca', () => {
  assert.throws(() => imposta('# Design\n', '{wp-cli}', 'x'), /### Paths/);
});

test('argomenti divide la riga rispettando virgolette e apici', () => {
  assert.deepEqual(argomenti('"/a b/php" -d x=1 "--path=/c d"'), ['/a b/php', '-d', 'x=1', '--path=/c d']);
  assert.deepEqual(argomenti("php   'a \"b\" $c'  d"), ['php', 'a "b" $c', 'd']);
  assert.deepEqual(argomenti('"a \\"b\\" \\$c \\\\"'), ['a "b" $c \\']);
  assert.deepEqual(argomenti(''), []);
});

test('argomenti rifiuta una virgoletta non chiusa', () => {
  assert.throws(() => argomenti('php "aperta'), /virgolett/);
});

test('comando mette le virgolette solo dove servono, e argomenti lo rilegge uguale', () => {
  const casi = [
    ['/Applications/MAMP/bin/php/php8.4.17/bin/php', '-d', 'memory_limit=512M', '/Users/Mario Rossi/Sites/y/wp-cli.phar', '--path=/Users/Mario Rossi/Sites/y'],
    ['C:/MAMP/bin/php/php8.4.27/php.exe', '-c', 'C:/Users/Public/Documents/Appsolute/MAMPPRO/conf/php.ini', 'C:/Users/Mario Rossi/Sites/x/wp-cli.phar', '--path=C:/Users/Mario Rossi/Sites/x'],
    ['/Users/Mario Rossi/php', 'costa $5', 'dice "ciao"', 'barra\\rovesciata', "l'apostrofo", ''],
  ];
  for (const argv of casi) assert.deepEqual(argomenti(comando(argv)), argv);
  const senzaSpazi = ['/Applications/MAMP/bin/php/php8.4.17/bin/php', '-d', 'memory_limit=512M', '/sito/wp-cli.phar', '--path=/sito'];
  assert.equal(comando(senzaSpazi), senzaSpazi.join(' '));
  assert.equal(comando(['C:/Users/Mario Rossi/x.phar', '--path=C:/Users/Mario Rossi']), '"C:/Users/Mario Rossi/x.phar" "--path=C:/Users/Mario Rossi"');
});
