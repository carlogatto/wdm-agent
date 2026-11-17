// Un file che chiude il processo con 0 a metà: le prove dopo non girano, e nessuna è riportata.
const test = require('node:test');

test('passa', () => {});
test('esce', () => {
  process.exit(0);
});
test('fallirebbe', () => {
  throw new Error('mai eseguita');
});
