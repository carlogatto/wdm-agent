// Ogni script .php citato da una skill ha sintassi valida per il PHP del sito di prova. Le prove
// vere su WordPress stanno in wp-page.test.js e wp-navigation.test.js.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

const sito = require('../lib/sito');
const { citati, assoluto } = require('../lib/citati');

describe('script .php citati dalle skill', { skip: sito.nonDisponibile() || false }, () => {
  for (const relativo of citati('.php')) {
    it(`${relativo}: sintassi valida`, () => {
      const r = spawnSync(sito.leggiConfig().php, ['-l', assoluto(relativo)], { encoding: 'utf8' });
      assert.equal(r.status, 0, r.stdout + r.stderr);
    });
  }
});
