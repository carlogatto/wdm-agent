<?php
/**
 * fse-build — diff kit → WordPress di una pagina e scrittura della sola differenza. Si esegue con
 * WP-CLI (eval-file), dalla site root:
 *
 *   {wp-cli} eval-file ${CLAUDE_PLUGIN_ROOT}/skills/fse-build/scripts/wp-page.php plan  <file.html> page=<slug|ID>
 *   {wp-cli} eval-file ${CLAUDE_PLUGIN_ROOT}/skills/fse-build/scripts/wp-page.php apply <file.html> page=<slug|ID> [confirm]
 *
 * <file.html> è il markup a blocchi generato dal kit secondo i README (G); la pagina è W, trovata
 * per ID, per percorso URL (servizi/fisioterapia) o per slug (anche di una pagina figlia).
 * plan  → allinea i blocchi di primo livello per chiave (nome blocco + variante) e confronta gli
 *         attributi normalizzati (default omessi, entità decodificate, spazi collassati, figli
 *         inclusi). Esito per blocco: uguale · modificato (il kit vince) · nuovo · spostato ·
 *         da cancellare (in WP e non nel kit: blocco tolto dal kit o aggiunto a mano). Stampa la
 *         riga di sintesi e il diff; non scrive mai.
 * apply → scrive il contenuto fuso (i blocchi uguali tengono il blocco di WP riserializzato, stessi
 *         attributi; gli altri prendono il markup del kit; l'ordine è quello del kit) solo se c'è
 *         almeno una differenza (nessuna differenza → nessuna scrittura, post_modified intatto); con
 *         cancellazioni in attesa non scrive ed esce 3, salvo `confirm` (turno successivo, dopo
 *         l'ok del dev). Pagina assente: la crea la skill (`wp post create`), poi `apply`.
 *
 * Exit: 0 nessuna differenza · 1 differenze (plan) / scritto (apply) · 2 errore · 3 cancellazioni in attesa di conferma.
 */

if ( ! defined( 'ABSPATH' ) ) {
  fwrite( STDERR, "Eseguire con: {wp-cli} eval-file wp-page.php <plan|apply> <file.html> page=<slug|ID> [confirm]\n" );
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

// ---------- main ----------

if ( $fpg_mode !== 'plan' && $fpg_mode !== 'apply' ) {
  fpg_err( 'uso: plan <file.html> page=<slug|ID> | apply <file.html> page=<slug|ID> [confirm]' );
}
$file    = isset( $fpg_args[1] ) ? $fpg_args[1] : '';
$page    = '';
$confirm = false;
foreach ( array_slice( $fpg_args, 2 ) as $arg ) {
  if ( $arg === 'confirm' ) { $confirm = true; continue; }
  if ( strpos( $arg, 'page=' ) === 0 ) { $page = substr( $arg, 5 ); continue; }
  fpg_err( "argomento non valido: $arg (ammessi: page=<slug|ID>, confirm)" );
}
if ( $file === '' || ! file_exists( $file ) ) fpg_err( "file generato non trovato: $file" );
if ( $page === '' ) fpg_err( 'manca page=<slug|ID>' );

$post = fpg_find_page( $page );
$g    = fpg_top_blocks( file_get_contents( $file ) );
$w    = fpg_top_blocks( $post->post_content );
$ops  = fpg_align( $g, $w );
$n    = fpg_report( $post, $ops, $g, $w );
$diff = count( $ops ) - $n['uguale'];

if ( $fpg_mode === 'plan' ) {
  fpg_halt( $n['da cancellare'] > 0 ? 3 : ( $diff > 0 ? 1 : 0 ) );
}

if ( $n['da cancellare'] > 0 && ! $confirm ) {
  echo "\nNessuna scrittura: mostra il diff al dev e, solo dopo la sua conferma in un turno successivo, rilancia con `confirm`.\n";
  fpg_halt( 3 );
}
if ( $diff === 0 ) {
  echo "0 differenze, nessuna scrittura\n";
  fpg_halt( 0 );
}
// wp_update_post vuole dati slashati (wp_insert_post fa wp_unslash): senza wp_slash le sequenze
// \u0026, \u003c, \u0022, \u002d di serialize_block_attributes perdono la barra e l'attributo si corrompe.
$r = wp_update_post( array( 'ID' => $post->ID, 'post_content' => wp_slash( fpg_merge( $ops, $g, $w ) ) ), true );
if ( is_wp_error( $r ) ) fpg_err( 'update fallito: ' . $r->get_error_message() );
echo "scritto\n";
fpg_halt( 1 );
