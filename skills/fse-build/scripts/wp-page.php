<?php
/**
 * fse-build — diff kit → WordPress di una pagina e scrittura della sola differenza. Si esegue con
 * WP-CLI (eval-file), dalla site root:
 *
 *   {wp-cli} eval-file ${CLAUDE_PLUGIN_ROOT}/skills/fse-build/scripts/wp-page.php plan  <file.html> page=<slug|ID>
 *   {wp-cli} eval-file ${CLAUDE_PLUGIN_ROOT}/skills/fse-build/scripts/wp-page.php apply <file.html> page=<slug|ID> [confirm] [forza]
 *
 * <file.html> è il markup a blocchi generato dal kit secondo i README (G); la pagina è W, trovata
 * per ID, per percorso URL (servizi/fisioterapia) o per slug (anche di una pagina figlia).
 * Il file generato si controlla prima di tutto: ogni commento di blocco deve avere attributi che
 * sono un oggetto JSON, altrimenti exit 2 (un blocco scritto senza attributi sembrerebbe a posto).
 *
 * plan  → allinea i blocchi di primo livello per chiave (nome blocco + variante) e confronta gli
 *         attributi normalizzati (default omessi, entità decodificate, spazi collassati, figli
 *         inclusi). Stampa la riga di sintesi e il diff; non scrive mai.
 * apply → scrive solo se c'è una differenza (nessuna differenza → nessuna scrittura, post_modified
 *         intatto) e mai su una pagina aperta nell'editor da un utente (exit 4).
 *
 * Due casi, decisi dal meta `_fse_build` che apply salva a ogni scrittura (impronta del contenuto
 * normalizzato scritto, chiavi dei blocchi del kit):
 *
 * 1. Pagina non toccata a mano (l'impronta attuale è quella salvata): il kit vince. Esito per
 *    blocco: uguale · modificato · nuovo · spostato · da cancellare (in WP e non nel kit). I
 *    blocchi uguali tengono il blocco di WP riserializzato, gli altri prendono il markup del kit,
 *    l'ordine è quello del kit. Con cancellazioni in attesa non scrive ed esce 3, salvo `confirm`
 *    (turno successivo, dopo l'ok del dev).
 * 2. Pagina modificata a mano in WordPress: WordPress è il padrone, e lo resta. I blocchi
 *    esistenti restano come sono, ordine compreso (protetto, se differiscono dal kit). Dal kit
 *    entrano solo i blocchi nati dopo l'ultima build (nuovo), dopo il blocco che li precede nel
 *    kit. Un blocco che il cliente ha tolto non torna (tolto a mano); uno che ha aggiunto resta
 *    (aggiunto a mano); uno che il kit ha tolto è da cancellare, con `confirm` come sopra.
 *    Senza meta (pagine costruite prima di questa regola) la pagina è «modificata a mano» se
 *    l'ultima revisione ha un autore.
 *
 * `forza` (solo su richiesta esplicita del dev per quella pagina, in un turno successivo): tratta
 * la pagina come non toccata, il kit vince e la pagina torna al caso 1.
 * Pagina assente: la crea la skill (`wp post create`), poi `apply`.
 *
 * Exit: 0 nessuna differenza · 2 errore · 3 cancellazioni in attesa di conferma · 4 pagina aperta
 * nell'editor da un utente, nulla scritto · 5 differenze (plan) / scritto (apply) · 6 nulla da
 * scrivere, ma la pagina è stata modificata a mano e differisce dal kit. L'exit 1 non è mai dello
 * script: è un errore di WP-CLI o di PHP.
 */

if ( ! defined( 'ABSPATH' ) ) {
  fwrite( STDERR, "Eseguire con: {wp-cli} eval-file wp-page.php <plan|apply> <file.html> page=<slug|ID> [confirm] [forza]\n" );
  exit( 2 );
}

$fpg_args = isset( $args ) && is_array( $args ) ? $args : array();
$fpg_mode = isset( $fpg_args[0] ) ? $fpg_args[0] : '';

function fpg_halt( $code ) {
  if ( class_exists( 'WP_CLI' ) ) {
    WP_CLI::halt( $code );
  }
  exit( $code );
}

function fpg_err( $msg, $code = 2 ) {
  fwrite( STDERR, "wp-page: $msg\n" );
  fpg_halt( $code );
}

// ---------- blocchi ----------

// Blocchi di primo livello: i blocchi veri più il "contenuto libero" (HTML senza commenti blocco,
// blockName null con innerHTML non vuoto); il solo whitespace fra i blocchi cade.
function fpg_top_blocks( $content ) {
  $out = array();
  foreach ( parse_blocks( (string) $content ) as $b ) {
    if ( $b['blockName'] === null && trim( (string) $b['innerHTML'] ) === '' ) continue;
    $out[] = $b;
  }
  return $out;
}

function fpg_is_free( $b ) {
  return $b['blockName'] === null;
}

// Variante effettiva: l'attributo salvato, altrimenti il default del tipo registrato (WP omette gli
// attributi al default, il kit li scrive espliciti: lo stesso blocco deve avere la stessa chiave).
function fpg_variant( $b ) {
  if ( isset( $b['attrs']['variant'] ) && is_scalar( $b['attrs']['variant'] ) ) return (string) $b['attrs']['variant'];
  $defaults = fpg_defaults( $b['blockName'] );
  return isset( $defaults['variant'] ) && is_scalar( $defaults['variant'] ) ? (string) $defaults['variant'] : '';
}

function fpg_key( $b ) {
  if ( fpg_is_free( $b ) ) return '(contenuto libero)';
  return $b['blockName'] . '|' . fpg_variant( $b );
}

function fpg_label( $b ) {
  if ( fpg_is_free( $b ) ) return '(contenuto libero)';
  $variant = fpg_variant( $b );
  return $b['blockName'] . ( $variant !== '' ? " ($variant)" : '' );
}

function fpg_norm_value( $v ) {
  if ( is_string( $v ) ) {
    $v = html_entity_decode( $v, ENT_QUOTES | ENT_HTML5, 'UTF-8' );
    return trim( preg_replace( '/\s+/u', ' ', $v ) );
  }
  if ( is_array( $v ) ) {
    $out = array();
    foreach ( $v as $k => $x ) $out[ $k ] = fpg_norm_value( $x );
    ksort( $out );
    return $out;
  }
  return $v;
}

function fpg_defaults( $name ) {
  $type = WP_Block_Type_Registry::get_instance()->get_registered( $name );
  if ( ! $type || ! is_array( $type->attributes ) ) return array();
  $d = array();
  foreach ( $type->attributes as $k => $def ) {
    if ( is_array( $def ) && array_key_exists( 'default', $def ) ) $d[ $k ] = fpg_norm_value( $def['default'] );
  }
  return $d;
}

// Forma normalizzata di un blocco: attributi senza default, `metadata` e `imageUrl` (ridondante con
// imageId), stringhe normalizzate, figli ricorsivi.
function fpg_norm( $b ) {
  if ( fpg_is_free( $b ) ) return array( 'html' => trim( (string) $b['innerHTML'] ) );
  $attrs    = is_array( $b['attrs'] ) ? $b['attrs'] : array();
  $defaults = fpg_defaults( $b['blockName'] );
  $norm     = array();
  foreach ( $attrs as $k => $v ) {
    if ( $k === 'metadata' ) continue;
    if ( $k === 'imageUrl' && isset( $attrs['imageId'] ) ) continue;
    $nv = fpg_norm_value( $v );
    if ( array_key_exists( $k, $defaults ) && $defaults[ $k ] === $nv ) continue;
    $norm[ $k ] = $nv;
  }
  ksort( $norm );
  $children = array();
  foreach ( (array) $b['innerBlocks'] as $c ) $children[] = array( 'key' => fpg_key( $c ), 'norm' => fpg_norm( $c ) );
  // Blocchi core senza figli: il contenuto è l'HTML, non un attributo.
  $html = '';
  if ( ! $children && strpos( $b['blockName'], 'core/' ) === 0 ) $html = fpg_norm_value( (string) $b['innerHTML'] );
  return array( 'attrs' => $norm, 'children' => $children, 'html' => $html );
}

function fpg_fmt( $v ) {
  if ( is_string( $v ) ) return '"' . ( mb_strlen( $v ) > 60 ? mb_substr( $v, 0, 57 ) . '…' : $v ) . '"';
  return json_encode( $v, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES );
}

// Differenze fra due forme normalizzate, come testo (`attr "prima" → "dopo"`, `figli`, `html`).
function fpg_changes( $nw, $ng ) {
  $parts = array();
  if ( isset( $nw['html'] ) && isset( $ng['html'] ) && ! isset( $nw['attrs'] ) ) {
    return $nw['html'] === $ng['html'] ? array() : array( 'html' );
  }
  $keys = array_unique( array_merge( array_keys( $nw['attrs'] ), array_keys( $ng['attrs'] ) ) );
  sort( $keys );
  foreach ( $keys as $k ) {
    $a = array_key_exists( $k, $nw['attrs'] ) ? $nw['attrs'][ $k ] : null;
    $b = array_key_exists( $k, $ng['attrs'] ) ? $ng['attrs'][ $k ] : null;
    if ( $a !== $b ) $parts[] = $k . ' ' . fpg_fmt( $a ) . ' → ' . fpg_fmt( $b );
  }
  if ( $nw['children'] !== $ng['children'] ) $parts[] = 'figli';
  if ( $nw['html'] !== $ng['html'] ) $parts[] = 'html';
  return $parts;
}

// ---------- allineamento ----------

// Sottosequenza comune più lunga sulle chiavi: coppie (i di G, j di W).
function fpg_lcs( $gk, $wk ) {
  $n = count( $gk ); $m = count( $wk );
  $L = array_fill( 0, $n + 1, array_fill( 0, $m + 1, 0 ) );
  for ( $i = $n - 1; $i >= 0; $i-- ) {
    for ( $j = $m - 1; $j >= 0; $j-- ) {
      $L[ $i ][ $j ] = $gk[ $i ] === $wk[ $j ] ? $L[ $i + 1 ][ $j + 1 ] + 1 : max( $L[ $i + 1 ][ $j ], $L[ $i ][ $j + 1 ] );
    }
  }
  $pairs = array(); $i = 0; $j = 0;
  while ( $i < $n && $j < $m ) {
    if ( $gk[ $i ] === $wk[ $j ] ) { $pairs[] = array( $i, $j ); $i++; $j++; }
    elseif ( $L[ $i + 1 ][ $j ] >= $L[ $i ][ $j + 1 ] ) $i++;
    else $j++;
  }
  return $pairs;
}

// ops nell'ordine di G (uguale | modificato | nuovo | spostato), poi le cancellazioni (W non accoppiati).
function fpg_align( $g, $w ) {
  $gk = array_map( 'fpg_key', $g );
  $wk = array_map( 'fpg_key', $w );
  $g_to_w = array();
  foreach ( fpg_lcs( $gk, $wk ) as $p ) $g_to_w[ $p[0] ] = $p[1];
  $w_used = array_flip( $g_to_w );
  $moved  = array();
  foreach ( $gk as $i => $k ) {
    if ( isset( $g_to_w[ $i ] ) ) continue;
    foreach ( $wk as $j => $kw ) {
      if ( $kw === $k && ! isset( $w_used[ $j ] ) ) { $g_to_w[ $i ] = $j; $w_used[ $j ] = $i; $moved[ $i ] = true; break; }
    }
  }
  $ops = array();
  foreach ( $g as $i => $gb ) {
    if ( ! isset( $g_to_w[ $i ] ) ) { $ops[] = array( 'op' => 'nuovo', 'g' => $i, 'w' => null, 'changes' => array() ); continue; }
    $j       = $g_to_w[ $i ];
    $changes = fpg_changes( fpg_norm( $w[ $j ] ), fpg_norm( $gb ) );
    if ( isset( $moved[ $i ] ) ) $ops[] = array( 'op' => 'spostato', 'g' => $i, 'w' => $j, 'changes' => $changes );
    elseif ( $changes ) $ops[] = array( 'op' => 'modificato', 'g' => $i, 'w' => $j, 'changes' => $changes );
    else $ops[] = array( 'op' => 'uguale', 'g' => $i, 'w' => $j, 'changes' => array() );
  }
  foreach ( $w as $j => $wb ) {
    if ( ! isset( $w_used[ $j ] ) ) $ops[] = array( 'op' => 'da cancellare', 'g' => null, 'w' => $j, 'changes' => array() );
  }
  return $ops;
}

function fpg_merge( $ops, $g, $w ) {
  $parts = array();
  foreach ( $ops as $op ) {
    if ( $op['op'] === 'da cancellare' ) continue;
    $parts[] = $op['op'] === 'uguale' ? serialize_block( $w[ $op['w'] ] ) : serialize_block( $g[ $op['g'] ] );
  }
  return implode( "\n\n", $parts );
}

function fpg_report( $post, $ops, $g, $w ) {
  $count = array( 'uguale' => 0, 'modificato' => 0, 'nuovo' => 0, 'spostato' => 0, 'da cancellare' => 0 );
  foreach ( $ops as $op ) $count[ $op['op'] ]++;
  echo "{$post->post_name} (id {$post->ID}): {$count['uguale']} uguale · {$count['modificato']} modificato · {$count['nuovo']} nuovo · {$count['spostato']} spostato · {$count['da cancellare']} da cancellare\n";
  $sym = array( 'uguale' => '=', 'modificato' => '~', 'nuovo' => '+', 'spostato' => '>', 'da cancellare' => '-' );
  foreach ( $ops as $op ) {
    $b    = $op['g'] !== null ? $g[ $op['g'] ] : $w[ $op['w'] ];
    $line = '  ' . $sym[ $op['op'] ] . ' ' . fpg_label( $b );
    if ( $op['op'] === 'spostato' ) $line .= ': posizione ' . ( $op['w'] + 1 ) . ' → ' . ( $op['g'] + 1 ) . ( $op['changes'] ? '; ' . implode( '; ', $op['changes'] ) : '' );
    elseif ( $op['changes'] ) $line .= ': ' . implode( '; ', $op['changes'] );
    echo $line, "\n";
  }
  return $count;
}

function fpg_find_page( $ref ) {
  if ( ctype_digit( (string) $ref ) ) {
    $p = get_post( (int) $ref );
    if ( ! $p ) fpg_err( "pagina assente: id $ref" );
    if ( $p->post_type !== 'page' ) fpg_err( "id $ref non è una pagina ({$p->post_type})" );
    return $p;
  }
  $p = get_page_by_path( $ref, OBJECT, 'page' );   // percorso completo: genitore/figlia
  if ( ! $p && strpos( $ref, '/' ) === false ) {    // solo slug: anche una pagina figlia
    $found = get_posts( array( 'post_name__in' => array( $ref ), 'post_type' => 'page', 'post_status' => 'any', 'numberposts' => 2 ) );   // `name` non vale per i post type gerarchici
    if ( count( $found ) > 1 ) fpg_err( "slug $ref ambiguo (" . count( $found ) . " pagine): usa page=<percorso> o page=<ID>" );
    $p = $found ? $found[0] : null;
  }
  if ( ! $p ) fpg_err( "pagina assente: $ref (creala con `wp post create`, poi rilancia)" );
  return $p;
}

// ---------- file generato: attributi (U17) ----------

// Un commento di blocco con attributi che non sono JSON valido viene letto da WordPress come un
// blocco senza attributi, o come testo: scritto così sembrerebbe a posto. Qui è un errore.
function fpg_stray_comment( $b ) {
  $parts = fpg_is_free( $b ) ? array( (string) $b['innerHTML'] ) : (array) $b['innerContent'];
  foreach ( $parts as $html ) {
    if ( is_string( $html ) && preg_match( '/<!--\s*\/?wp:[^>]{0,60}/', $html, $m ) ) return $m[0];
  }
  foreach ( (array) $b['innerBlocks'] as $c ) {
    $found = fpg_stray_comment( $c );
    if ( $found !== '' ) return $found;
  }
  return '';
}

function fpg_check_generated( $content ) {
  if ( preg_match_all( '/<!--\s+wp:([a-z][a-z0-9_-]*\/)?([a-z][a-z0-9_-]*)\s+(\{.*?\})\s+\/?-->/s', $content, $all, PREG_SET_ORDER ) ) {
    foreach ( $all as $m ) {
      $attrs = json_decode( $m[3], true );
      if ( ! is_array( $attrs ) || ( $attrs && array_is_list( $attrs ) ) ) {
        $name = ( $m[1] !== '' ? $m[1] : 'core/' ) . $m[2];
        fpg_err( "file generato, blocco $name: gli attributi non sono un oggetto JSON valido: " . mb_substr( $m[3], 0, 100 ) . ' — correggi il file e rilancia, nulla è stato scritto' );
      }
    }
  }
  foreach ( parse_blocks( $content ) as $b ) {
    $stray = fpg_stray_comment( $b );
    if ( $stray !== '' ) fpg_err( "file generato: commento di blocco non riconosciuto ({$stray}…) — correggi il file e rilancia, nulla è stato scritto" );
  }
}

// ---------- pagina aperta nell'editor (U16) ----------

// Il nome dell'utente che ha la pagina aperta nell'editor, o '' se nessuno.
function fpg_locked_by( $post_id ) {
  if ( ! function_exists( 'wp_check_post_lock' ) ) require_once ABSPATH . 'wp-admin/includes/post.php';
  $user = wp_check_post_lock( $post_id );
  if ( ! $user ) return '';
  $data = get_userdata( $user );
  return $data ? $data->display_name : "utente $user";
}

// ---------- contenuti del cliente (U53) ----------

const FPG_META = '_fse_build';

// Impronta del contenuto normalizzato: non cambia se l'editor riscrive spazi e righe vuote.
function fpg_hash( $blocks ) {
  $norm = array();
  foreach ( $blocks as $b ) $norm[] = array( fpg_key( $b ), fpg_norm( $b ) );
  return md5( wp_json_encode( $norm ) );
}

// { manual: la pagina è del cliente; base: chiavi dei blocchi del kit all'ultima scrittura; why }.
function fpg_state( $post, $w ) {
  $meta = get_post_meta( $post->ID, FPG_META, true );
  if ( is_array( $meta ) && isset( $meta['wp'] ) ) {
    $manual = ! empty( $meta['manuale'] ) || $meta['wp'] !== fpg_hash( $w );
    return array( 'manual' => $manual, 'base' => isset( $meta['blocchi'] ) ? (array) $meta['blocchi'] : array(), 'meta' => true, 'why' => 'il contenuto non è più quello scritto dall\'ultima build' );
  }
  // Pagine costruite prima del meta: l'ultima revisione dice chi ha salvato per ultimo (0 = WP-CLI).
  $revisions = $w ? wp_get_post_revisions( $post->ID, array( 'numberposts' => 1 ) ) : array();
  $last      = $revisions ? reset( $revisions ) : null;
  return array( 'manual' => $last && (int) $last->post_author !== 0, 'base' => array_map( 'fpg_key', $w ), 'meta' => false, 'why' => 'l\'ultima revisione è stata salvata da un utente' );
}

// Su una pagina del cliente senza nulla da scrivere: le chiavi del kit di oggi diventano la
// base. Così un blocco che il kit ha tolto per riallinearsi a WordPress non viene più preso,
// quando nel kit ne nasce uno con la stessa chiave, per «tolto a mano».
function fpg_save_base( $post_id, $g ) {
  $meta = get_post_meta( $post_id, FPG_META, true );
  if ( ! is_array( $meta ) || ! isset( $meta['wp'] ) ) return;
  $keys = array_map( 'fpg_key', $g );
  if ( isset( $meta['blocchi'] ) && $meta['blocchi'] === $keys ) return;
  $meta['blocchi'] = $keys;
  update_post_meta( $post_id, FPG_META, $meta );
}

function fpg_save_state( $post_id, $g, $manual ) {
  clean_post_cache( $post_id );
  update_post_meta( $post_id, FPG_META, array(
    'wp'      => fpg_hash( fpg_top_blocks( get_post( $post_id )->post_content ) ),
    'blocchi' => array_map( 'fpg_key', $g ),
    'manuale' => (bool) $manual,
  ) );
}

// Gli esiti di fpg_align riletti per una pagina del cliente: nessun blocco esistente si tocca.
function fpg_align_protected( $ops, $g, $w, $base ) {
  $in_base = array_count_values( $base );
  $in_w    = array_count_values( array_map( 'fpg_key', $w ) );
  $in_g    = array_count_values( array_map( 'fpg_key', $g ) );
  $count   = function ( $arr, $k ) { return isset( $arr[ $k ] ) ? $arr[ $k ] : 0; };
  $removed = array();   // per chiave: quanti blocchi del kit il cliente ha tolto
  $dropped = array();   // per chiave: quanti blocchi di WP il kit ha tolto
  $out     = array();
  foreach ( $ops as $op ) {
    if ( $op['op'] === 'spostato' ) {
      array_unshift( $op['changes'], 'posizione ' . ( $op['w'] + 1 ) . ' in WordPress, ' . ( $op['g'] + 1 ) . ' nel kit' );
      $op['op'] = 'protetto';
    } elseif ( $op['op'] === 'modificato' ) {
      $op['op'] = 'protetto';
    } elseif ( $op['op'] === 'nuovo' ) {
      $k = fpg_key( $g[ $op['g'] ] );
      if ( ! isset( $removed[ $k ] ) ) $removed[ $k ] = max( 0, $count( $in_base, $k ) - $count( $in_w, $k ) );
      if ( $removed[ $k ] > 0 ) { $removed[ $k ]--; $op['op'] = 'tolto a mano'; }
    } elseif ( $op['op'] === 'da cancellare' ) {
      $k = fpg_key( $w[ $op['w'] ] );
      if ( ! isset( $dropped[ $k ] ) ) $dropped[ $k ] = max( 0, $count( $in_base, $k ) - $count( $in_g, $k ) );
      if ( $dropped[ $k ] > 0 ) $dropped[ $k ]--; else $op['op'] = 'aggiunto a mano';
    }
    $out[] = $op;
  }
  return $out;
}

// Il contenuto di WordPress com'è, più i blocchi nuovi del kit (ognuno dopo il blocco che lo
// precede nel kit ed esiste in WordPress), meno le cancellazioni confermate.
function fpg_merge_protected( $ops, $g, $w ) {
  $g_to_w = array(); $delete = array(); $new = array();
  foreach ( $ops as $op ) {
    if ( $op['g'] !== null && $op['w'] !== null ) $g_to_w[ $op['g'] ] = $op['w'];
    if ( $op['op'] === 'da cancellare' ) $delete[ $op['w'] ] = true;
    if ( $op['op'] === 'nuovo' ) $new[] = $op['g'];
  }
  $head = array(); $after = array();
  foreach ( $new as $i ) {
    $anchor = null;
    for ( $p = $i - 1; $p >= 0; $p-- ) { if ( isset( $g_to_w[ $p ] ) ) { $anchor = $g_to_w[ $p ]; break; } }
    if ( $anchor === null ) $head[] = serialize_block( $g[ $i ] ); else $after[ $anchor ][] = serialize_block( $g[ $i ] );
  }
  $parts = $head;
  foreach ( $w as $j => $wb ) {
    if ( ! isset( $delete[ $j ] ) ) $parts[] = serialize_block( $wb );
    if ( isset( $after[ $j ] ) ) $parts = array_merge( $parts, $after[ $j ] );
  }
  return implode( "\n\n", $parts );
}

function fpg_report_protected( $post, $ops, $g, $w, $why ) {
  $count = array( 'uguale' => 0, 'protetto' => 0, 'nuovo' => 0, 'tolto a mano' => 0, 'aggiunto a mano' => 0, 'da cancellare' => 0 );
  foreach ( $ops as $op ) $count[ $op['op'] ]++;
  echo "{$post->post_name} (id {$post->ID}), modificata a mano in WordPress ($why): i blocchi esistenti restano come sono\n";
  echo "  {$count['uguale']} uguale · {$count['protetto']} protetto · {$count['nuovo']} nuovo · {$count['tolto a mano']} tolto a mano · {$count['aggiunto a mano']} aggiunto a mano · {$count['da cancellare']} da cancellare\n";
  $sym = array( 'uguale' => '=', 'protetto' => '!', 'nuovo' => '+', 'tolto a mano' => 'x', 'aggiunto a mano' => '*', 'da cancellare' => '-' );
  foreach ( $ops as $op ) {
    $b    = $op['g'] !== null ? $g[ $op['g'] ] : $w[ $op['w'] ];
    $line = '  ' . $sym[ $op['op'] ] . ' ' . fpg_label( $b );
    if ( $op['op'] !== 'uguale' ) $line .= ' — ' . $op['op'];
    if ( $op['changes'] ) $line .= ': ' . implode( '; ', $op['changes'] );
    echo $line, "\n";
  }
  return $count;
}

// ---------- main ----------

if ( $fpg_mode !== 'plan' && $fpg_mode !== 'apply' ) {
  fpg_err( 'uso: plan <file.html> page=<slug|ID> | apply <file.html> page=<slug|ID> [confirm] [forza]' );
}
$file    = isset( $fpg_args[1] ) ? $fpg_args[1] : '';
$page    = '';
$confirm = false;
$force   = false;
foreach ( array_slice( $fpg_args, 2 ) as $arg ) {
  if ( $arg === 'confirm' ) { $confirm = true; continue; }
  if ( $arg === 'forza' ) { $force = true; continue; }
  if ( strpos( $arg, 'page=' ) === 0 ) { $page = substr( $arg, 5 ); continue; }
  fpg_err( "argomento non valido: $arg (ammessi: page=<slug|ID>, confirm, forza)" );
}
if ( $file === '' || ! file_exists( $file ) ) fpg_err( "file generato non trovato: $file" );
if ( $page === '' ) fpg_err( 'manca page=<slug|ID>' );

$generated = file_get_contents( $file );
fpg_check_generated( $generated );

$post   = fpg_find_page( $page );
$g      = fpg_top_blocks( $generated );
$w      = fpg_top_blocks( $post->post_content );
$state  = fpg_state( $post, $w );
$manual = $state['manual'] && ! $force;
$ops    = fpg_align( $g, $w );

if ( $manual ) {
  $ops     = fpg_align_protected( $ops, $g, $w, $state['base'] );
  $n       = fpg_report_protected( $post, $ops, $g, $w, $state['why'] );
  $write   = $n['nuovo'] + ( $confirm ? $n['da cancellare'] : 0 );
  $left    = $n['protetto'] + $n['tolto a mano'] + $n['aggiunto a mano'];
  $content = fpg_merge_protected( $ops, $g, $w );
} else {
  $n       = fpg_report( $post, $ops, $g, $w );
  $write   = count( $ops ) - $n['uguale'];
  $left    = 0;
  $content = fpg_merge( $ops, $g, $w );
}

if ( $fpg_mode === 'plan' ) {
  fpg_halt( $n['da cancellare'] > 0 ? 3 : ( $write > 0 ? 5 : ( $left > 0 ? 6 : 0 ) ) );
}

if ( $n['da cancellare'] > 0 && ! $confirm ) {
  echo "\nNessuna scrittura: mostra il diff al dev e, solo dopo la sua conferma in un turno successivo, rilancia con `confirm`.\n";
  fpg_halt( 3 );
}
if ( $write === 0 ) {
  if ( $left > 0 ) {
    fpg_save_base( $post->ID, $g );
    echo "nessuna scrittura: la pagina è stata modificata a mano in WordPress e resta com'è\n";
    fpg_halt( 6 );
  }
  // Pagina identica al kit: l'impronta si (ri)scrive, così una modifica a mano successiva si
  // riconosce, e una pagina del cliente riallineata al kit torna una pagina normale.
  if ( $w && ( ! $state['meta'] || $state['manual'] ) ) fpg_save_state( $post->ID, $g, false );
  echo "0 differenze, nessuna scrittura\n";
  fpg_halt( 0 );
}
$who = fpg_locked_by( $post->ID );
if ( $who !== '' ) {
  echo "\nNessuna scrittura: la pagina è aperta nell'editor da $who. Chiudi la scheda dell'editor e rilancia.\n";
  fpg_halt( 4 );
}
// wp_update_post vuole dati slashati (wp_insert_post fa wp_unslash): senza wp_slash le sequenze
// &, <, ", - di serialize_block_attributes perdono la barra e l'attributo si corrompe.
$r = wp_update_post( array( 'ID' => $post->ID, 'post_content' => wp_slash( $content ) ), true );
if ( is_wp_error( $r ) ) fpg_err( 'update fallito: ' . $r->get_error_message() );
fpg_save_state( $post->ID, $g, $manual );
echo "scritto\n";
fpg_halt( 5 );
