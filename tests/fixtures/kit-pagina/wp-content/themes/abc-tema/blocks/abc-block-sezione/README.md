# abc/sezione — Sezione

## Scopo
Fixture: una sezione con tutto il vocabolario.

## Varianti
| Variante | Attributi | Classe | Kit |
|---|---|---|---|
| piena (default) | `variant: "piena"` | `abc-block-sezione--piena` | — |
| divisa | `variant: "divisa"` | `abc-block-sezione--divisa` | — |

## Attributi
| Nome | Tipo | Controllo | Default | Note |
|---|---|---|---|---|
| `variant` | string (enum) | SelectControl | `piena` | valore sconosciuto → `piena` |
| `headingLevel` | integer | ToggleGroupControl H2 / H3 | `2` | tag del titolo |
| `title` | string | RichText h2/h3 | `""` | omesso se vuoto |
| `text` | string | RichText p | `""` | omesso se vuoto |
| `occhiello` | string | RichText p | `""` | kit: `.__sopra` |
| `imageId` | integer | ImageControl | `0` | |
| `imageUrl` | string | ImageControl | `""` | |
| `imageAlt` | string | ImageControl | `""` | |
| `buttonText` | string | LinkButton | `""` | |
| `buttonUrl` | string | LinkButton | `""` | |
| `buttonNewTab` | boolean | LinkButton | `false` | |
| `secondaryButtonText` | string | LinkButton (secondo) | `""` | secondo bottone `is-style-outline`, dentro `__buttons` |
| `secondaryButtonUrl` | string | LinkButton (secondo) | `""` | |
| `columns` | integer | RangeControl 2–4 | `3` | → `style="--abc-columns:N"` sulla `__grid` |
| `perView` | integer 2–6 | RangeControl | `4` | → `data-per-view` letto da view.js |
| `centered` | boolean | ToggleControl | `true` | `false` → `__inner--start` |
| `align` | string | supports.align | `full` | |

Supports: `anchor`, `color.background/text` (con sfondo → bottone `is-style-inverted`),
`spacing.padding`.

## Figli
`abc/voce` (`../abc-block-voce/README.md`): icon, kicker, title, text, linkText/linkUrl.

## Markup (render.php = kit)
```html
<section class="wp-block-abc-sezione alignfull abc-block-sezione abc-block-sezione--piena|--divisa">
  <div class="abc-block-sezione__inner">
    <p class="abc-block-sezione__sopra">…</p>
    <h2 class="abc-block-sezione__title">…</h2>
    <p class="abc-block-sezione__text">…</p>
    <figure class="abc-block-sezione__media"><img class="abc-block-sezione__img" src alt></figure>
    <div class="abc-block-sezione__grid" style="--abc-columns:3" data-per-view="4" data-a11y-prev>…</div>
    <a class="wp-element-button abc-block-sezione__button" href>…</a>
  </div>
</section>
```

## Markup di inserimento
```html
<!-- wp:abc/sezione {"title":"…"} /-->
```

## Dipendenze JS / CSS
—

## Componenti condivisi
—
