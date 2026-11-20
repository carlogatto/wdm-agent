// Il frontmatter di ogni skill è YAML valido: `name` e una `description` su una riga, tra apici
// singoli (un apostrofo nel testo si scrive raddoppiato). Senza apici, « #» tronca la
// description e «: » la rende un errore di sintassi.
// Due skill, il kit e la build, girano in un sotto-agente in primo piano (`context: fork`): la
// conversazione principale non ne vede il testo, solo la description e il risultato.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SKILLS = path.join(__dirname, '..', 'skills');

const skills = fs.readdirSync(SKILLS).filter((d) => fs.existsSync(path.join(SKILLS, d, 'SKILL.md')));
const IN_SOTTO_AGENTE = ['fse-build', 'fse-kit'];
const FORK = ['context: fork', 'agent: general-purpose', 'background: false'];

test('le skill sono sei', () => {
  assert.equal(skills.length, 6);
});

for (const skill of skills) {
  test(`frontmatter di ${skill}`, () => {
    const lines = fs.readFileSync(path.join(SKILLS, skill, 'SKILL.md'), 'utf8').split('\n');
    assert.equal(lines[0], '---');
    assert.equal(lines[1], `name: ${skill}`);
    if (IN_SOTTO_AGENTE.includes(skill)) {
      assert.deepEqual(lines.slice(3, 7), [...FORK, '---'], 'dopo name e description: context, agent, background');
    } else {
      assert.equal(lines[3], '---', 'il frontmatter ha solo name e description');
    }
    const quoted = /^description: '(.*)'$/.exec(lines[2]);
    assert.ok(quoted, 'description su una riga, tra apici singoli');
    assert.ok(!quoted[1].replaceAll("''", '').includes("'"), 'ogni apostrofo nel testo è raddoppiato');
    const value = quoted[1].replaceAll("''", "'");
    assert.ok(value.length > 200, `description troppo corta: ${value.length} caratteri`);
    assert.ok(value.startsWith('Use '), 'la description dice quando usare la skill');
    // La description è l'unico testo che la conversazione principale legge di una skill che gira
    // in un sotto-agente: deve dirle che cosa passare.
    if (IN_SOTTO_AGENTE.includes(skill)) {
      assert.match(value, /sub-agent/);
      assert.match(value, /word for word/);
      assert.match(value, /anteprima=/);
    }
  });
}
