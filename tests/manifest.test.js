// plugin.json e marketplace.json: campi obbligatori, nome, versione uguale nei due file, source "./".
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const leggi = (nome) => JSON.parse(fs.readFileSync(path.join(__dirname, '..', '.claude-plugin', nome), 'utf8'));

test('plugin.json: nome, versione, autore, repository', () => {
  const p = leggi('plugin.json');
  assert.equal(p.name, 'wdm-agent');
  assert.match(p.version, /^[0-9]+\.[0-9]+\.[0-9]+$/);
  assert.ok(p.author && p.author.name, 'manca author.name');
  assert.match(p.repository, /github\.com\/carlogatto\/wdm-agent/);
});

test('marketplace.json: un solo plugin, source "./"', () => {
  const m = leggi('marketplace.json');
  assert.equal(m.name, 'wdm-agent');
  assert.ok(m.owner && m.owner.name, 'manca owner.name');
  assert.equal(m.plugins.length, 1);
  assert.equal(m.plugins[0].name, 'wdm-agent');
  assert.equal(m.plugins[0].source, './');
});

test('la versione è la stessa nei due file', () => {
  assert.equal(leggi('plugin.json').version, leggi('marketplace.json').plugins[0].version);
});
