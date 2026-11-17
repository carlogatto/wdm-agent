// Due livelli sotto la radice: l'esecutore non la lancerebbe, quindi deve rifiutarla.
const test = require('node:test');

test('mai eseguita', () => {
  throw new Error('fuori posto');
});
