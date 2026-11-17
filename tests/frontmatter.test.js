// Il frontmatter di ogni skill è YAML valido: `name` e una `description` su una riga, tra apici
// singoli (un apostrofo nel testo si scrive raddoppiato). Senza apici, « #» tronca la
// description e «: » la rende un errore di sintassi.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SKILLS = path.join(__dirname, '..', 'skills');

const skills = fs.readdirSync(SKILLS).filter((d) => fs.existsSync(path.join(SKILLS, d, 'SKILL.md')));

test('le skill sono sei', () => {
  assert.equal(skills.length, 6);
});

for (const skill of skills) {
  test(`frontmatter di ${skill}`, () => {
    const lines = fs.readFileSync(path.join(SKILLS, skill, 'SKILL.md'), 'utf8').split('\n');
    assert.equal(lines[0], '---');
    assert.equal(lines[1], `name: ${skill}`);
    assert.equal(lines[3], '---', 'il frontmatter ha solo name e description');
    const quoted = /^description: '(.*)'$/.exec(lines[2]);
    assert.ok(quoted, 'description su una riga, tra apici singoli');
    assert.ok(!quoted[1].replaceAll("''", '').includes("'"), 'ogni apostrofo nel testo è raddoppiato');
    const value = quoted[1].replaceAll("''", "'");
    assert.ok(value.length > 200, `description troppo corta: ${value.length} caratteri`);
    assert.ok(value.startsWith('Use '), 'la description dice quando usare la skill');
  });
}
