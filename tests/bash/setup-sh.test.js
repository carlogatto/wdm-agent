// setup.sh è ancora in bash: finché non è riscritto in Node, qui se ne prova solo l'avvio.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

const { citati, assoluto } = require('../lib/citati');

describe('script .sh citati dalle skill', () => {
  for (const relativo of citati('.sh')) {
    it(`${relativo}: sintassi valida`, () => {
      const r = spawnSync('bash', ['-n', assoluto(relativo)], { encoding: 'utf8' });
      assert.equal(r.status, 0, r.stderr);
    });
  }

  it('setup.sh senza argomenti: dice cosa manca ed esce con 2', () => {
    const r = spawnSync('bash', [assoluto('skills/fse-theme-setup/scripts/setup.sh')], { encoding: 'utf8' });
    assert.equal(r.status, 2, r.stdout + r.stderr);
    assert.match(r.stderr, /missing arguments/);
  });
});
