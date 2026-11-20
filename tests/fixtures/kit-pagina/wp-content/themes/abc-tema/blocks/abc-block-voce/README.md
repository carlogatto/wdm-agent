# abc/voce — Voce

## Scopo
Fixture: figlio di `abc/sezione`.

## Varianti
| Variante | Cosa cambia | Kit |
|---|---|---|
| — | — | — |

## Attributi
| Nome | Tipo | Controllo | Default | Note |
|---|---|---|---|---|
| `icon` | string (enum del set + `""`) | SelectControl | `""` | |
| `iconId` | integer | SvgControl | `0` | |
| `kicker` | string | RichText p | `""` | |
| `title` | string | RichText h3 | `""` | |
| `text` | string | RichText p | `""` | |
| `linkText` | string | LinkButton | `""` | |
| `linkUrl` | string | LinkButton | `""` | |

Supports: nessuno (`html: false`).

## Figli
—

## Markup (render.php = kit)
```html
<div class="wp-block-abc-voce abc-block-voce">
  <span class="abc-block-voce__icon" aria-hidden="true"><svg …></svg></span>
  <p class="abc-block-voce__kicker">…</p>
  <h3 class="abc-block-voce__title">…</h3>
  <p class="abc-block-voce__text">…</p>
  <a class="abc-block-voce__link" href>…</a>
</div>
```

## Markup di inserimento
—

## Dipendenze JS / CSS
—

## Componenti condivisi
—
