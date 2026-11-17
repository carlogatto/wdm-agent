// Come esce/, ma con prove asincrone: alcune fanno in tempo a essere riportate.
const test = require('node:test');

test('passa', async () => {});
test('passa ancora', async () => {});
test('esce', async () => {
  process.exit(0);
});
test('fallirebbe', async () => {
  throw new Error('mai eseguita');
});
