# abc/giostra — Carosello

## Scopo
Fixture: schede a mano o da una query.

## Varianti
| Variante | Cosa cambia | Kit |
|---|---|---|
| manual (default) | `source: "manual"`, classe `--manual`, figli `abc/scheda` | — |
| query | `source: "query"`, classe `--query`, nessun figlio reso | — |

## Attributi
| Nome | Tipo | Controllo | Default | Note |
|---|---|---|---|---|
| `source` | string `manual\|query` | SelectControl | `manual` | |
| `title` | string | RichText h2/h3 | `""` | |
| `headingLevel` | integer 2–3 | ToggleGroupControl | `2` | |
| `postType` | string | PostTypeSelect (solo query) | `post` | |
| `count` | integer 1–24 | RangeControl (solo query) | `8` | |
| `align` | string | supports.align | `full` | |

Supports: `anchor`.

## Figli
`abc/scheda` (`../abc-block-scheda/README.md`): modalità post o manuale. Solo in `manual`.

## Markup (render.php = kit)
```html
<section class="wp-block-abc-giostra alignfull abc-block-giostra abc-block-giostra--manual">
  <div class="abc-block-giostra__inner">
    <h2 class="abc-block-giostra__title">…</h2>
    <div class="swiper abc-block-giostra__swiper">
      <div class="swiper-wrapper"><div class="swiper-slide"><article class="wp-block-abc-scheda abc-block-scheda">…</article></div></div>
    </div>
  </div>
</section>
```

## Markup di inserimento
—

## Dipendenze JS / CSS
—

## Componenti condivisi
—
