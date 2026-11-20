# abc/modulo — Form

## Scopo
Fixture: un form di Formidable.

## Varianti
—

## Attributi
| Nome | Tipo | Controllo | Default | Note |
|---|---|---|---|---|
| `title` | string | RichText h2 | `""` | |
| `formId` | integer | NumberControl | `0` | `0` → `__form` omesso |
| `align` | string | supports.align | `full` | |

Supports: `anchor`, `color.background/text`.

## Figli
—

## Markup (render.php = kit)
```html
<section class="wp-block-abc-modulo alignfull abc-block-modulo">
  <div class="abc-block-modulo__inner">
    <h2 class="abc-block-modulo__title">…</h2>
    <div class="abc-block-modulo__form"><!-- output del plugin --></div>
  </div>
</section>
```
**Parità kit ↔ render: fino a `__form` incluso** (eccezione output di plugin).

## Markup di inserimento
—

## Dipendenze JS / CSS
—

## Componenti condivisi
—
