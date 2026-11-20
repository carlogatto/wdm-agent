# abc/scheda — Scheda

## Scopo
Fixture: da un post o a mano.

## Varianti
| Variante | Cosa cambia | Kit |
|---|---|---|
| — | Modalità: post (`postId` > 0) / manuale (`postId` 0) | — |

## Attributi
| Nome | Tipo | Controllo | Default | Note |
|---|---|---|---|---|
| `postType` | string | PostTypeSelect | `post` | |
| `postId` | integer | PostPicker | `0` | |
| `title` | string | RichText h3 (solo manuale) | `""` | |
| `text` | string | RichText p (solo manuale) | `""` | mai nella modalità post |
| `imageId` | integer | ImageControl | `0` | |
| `imageUrl` | string | ImageControl | `""` | |
| `imageAlt` | string | ImageControl | `""` | |
| `linkText` | string | LinkButton | `Scopri di più` | |
| `linkUrl` | string | LinkButton | `""` | |

Supports: nessuno.

## Figli
—

## Markup (render.php = kit)
```html
<article class="wp-block-abc-scheda abc-block-scheda">
  <a class="abc-block-scheda__thumb" href><img class="abc-block-scheda__img" src alt></a>
  <div class="abc-block-scheda__body">
    <h3 class="abc-block-scheda__title"><a href>Titolo</a></h3>
    <p class="abc-block-scheda__text">…</p>
  </div>
  <div class="abc-block-scheda__footer"><a class="abc-block-scheda__link" href>Scopri di più</a></div>
</article>
```

## Markup di inserimento
—

## Dipendenze JS / CSS
—

## Componenti condivisi
—
