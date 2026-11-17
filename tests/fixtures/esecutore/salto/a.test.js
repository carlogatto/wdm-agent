// Le quattro forme in cui una prova può non essere eseguita: l'esecutore deve vederle tutte.
const { test, describe, it } = require('node:test');

test('passa', () => {});
test('saltata con l\'opzione', { skip: 'motivo uno' }, () => {});
describe('gruppo saltato per intero', { skip: 'motivo due' }, () => {
  it('mai eseguita', () => {});
});
test('saltata dall\'interno', (t) => {
  t.skip('motivo tre');
});
test('da fare', { todo: 'motivo quattro' }, () => {});
