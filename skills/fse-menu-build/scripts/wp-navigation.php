<?php
/**
 * fse-menu-build — unico write path verso i post `wp_navigation` e il `ref` dei blocchi
 * `core/navigation` nelle parts del tema. Si esegue con WP-CLI (eval-file), dalla site root:
 *
 *   {wp-cli} eval-file ${CLAUDE_PLUGIN_ROOT}/skills/fse-menu-build/scripts/wp-navigation.php dump
 *   {wp-cli} eval-file ${CLAUDE_PLUGIN_ROOT}/skills/fse-menu-build/scripts/wp-navigation.php plan header=<kit> footer=<kit> > {scratchpad}/nav-plan.json
 *   {wp-cli} eval-file ${CLAUDE_PLUGIN_ROOT}/skills/fse-menu-build/scripts/wp-navigation.php apply <plan.json> [confirm] [parts=<dir>]
 *
 * dump  → JSON: ref dei blocchi navigation per part (parts/*.html), post wp_navigation con
 *         l'albero delle voci, pagine di ogni stato, pagina in front.
 * plan  → legge le `<nav><ul>` dei kit indicati (part=percorso, in ordine), risolve ogni voce
 *         a una pagina pubblicata (titolo → slug → orfana), unisce le liste identiche in un
 *         solo menu (stesso ref in più parts; `aria` = aria-label del <nav> per part, usato per
 *         scegliere il blocco navigation giusto quando una part ne ha più di uno) e stampa il
 *         piano JSON; avvisi su stderr.
 * apply → per ogni menu del piano: trova il post (ref della prima part → titolo), lo crea se
 *         manca, confronta il contenuto; se differisce stampa il diff ed esce 3 senza
 *         scrivere, salvo `confirm`; poi riscrive `"ref":N` nel blocco navigation di OGNI part
 *         elencata (core non controlla il post type del ref: un id sbagliato stampa una pagina
 *         dentro il menu). `parts=<dir>` sostituisce {theme-root}/parts (test, dry run).
 *
 * Exit: 0 ok · 1 errore · 3 differenze in attesa di conferma.
 */

if ( ! defined( 'ABSPATH' ) ) {
  fwrite( STDERR, "Eseguire con: {wp-cli} eval-file wp-navigation.php <dump|plan|apply> …\n" );
  exit( 1 );
}

$fmb_args = isset( $args ) && is_array( $args ) ? $args : array();
$fmb_mode = isset( $fmb_args[0] ) ? $fmb_args[0] : '';

function fmb_halt( $code ) {
  if ( class_exists( 'WP_CLI' ) ) {
    WP_CLI::halt( $code );
  }
  exit( $code );
}

function fmb_err( $msg, $code = 1 ) {
  fwrite( STDERR, "wp-navigation: $msg\n" );
  fmb_halt( $code );
}

function fmb_json( $data ) {
  echo json_encode( $data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES ), "\n";
}

// ---------- parts/*.html → ref dei blocchi navigation ----------

function fmb_parts_dir( $override = '' ) {
  return $override !== '' ? rtrim( $override, '/' ) : get_stylesheet_directory() . '/parts';
}

// Per ogni part: i blocchi navigation con ariaLabel e ref (una part può averne più di uno,
// es. footer con menu principale + menu legale: il ref si assegna al blocco con l'ariaLabel giusto).
function fmb_part_navs( $dir ) {
  $out = array();
  foreach ( (array) glob( $dir . '/*.html' ) as $file ) {
    $part   = basename( $file, '.html' );
    $html   = file_get_contents( $file );
    $blocks = array();
    if ( preg_match_all( '/<!-- wp:navigation (\{.*?\}) \/?-->/s', $html, $m ) ) {
      foreach ( $m[1] as $json ) {
        $attrs    = json_decode( $json, true );
        $blocks[] = array(
          'ariaLabel' => is_array( $attrs ) && isset( $attrs['ariaLabel'] ) ? $attrs['ariaLabel'] : null,
          'ref'       => is_array( $attrs ) && isset( $attrs['ref'] ) ? (int) $attrs['ref'] : null,
        );
      }
    }
    $out[ $part ] = $blocks;
  }
  return $out;
}

// Il blocco navigation di una part a cui si riferisce un menu: l'unico, oppure quello con
// ariaLabel = aria-label del <nav> del kit per quella part (plan → menu.aria[part]).
function fmb_pick_nav_block( $blocks, $aria ) {
  if ( count( $blocks ) === 1 ) return 0;
  foreach ( $blocks as $i => $b ) {
    if ( $aria !== null && $b['ariaLabel'] === $aria ) return $i;
  }
  return null;
}

// ---------- wp_navigation ----------

function fmb_items_from_blocks( $blocks ) {
  $items = array();
  foreach ( $blocks as $b ) {
    if ( empty( $b['blockName'] ) ) continue;
    $a    = isset( $b['attrs'] ) ? $b['attrs'] : array();
    $item = array( 'block' => $b['blockName'], 'label' => isset( $a['label'] ) ? $a['label'] : '' );
    if ( $b['blockName'] === 'core/home-link' ) {
      $item['home'] = true;
    } else {
      if ( isset( $a['id'] ) ) $item['page'] = (int) $a['id'];
      if ( isset( $a['url'] ) ) $item['url'] = $a['url'];
      if ( isset( $a['kind'] ) ) $item['kind'] = $a['kind'];
    }
    if ( ! empty( $b['innerBlocks'] ) ) $item['children'] = fmb_items_from_blocks( $b['innerBlocks'] );
    $items[] = $item;
  }
  return $items;
}

function fmb_navigations() {
  $out = array();
  $posts = get_posts( array( 'post_type' => 'wp_navigation', 'post_status' => 'any', 'numberposts' => -1, 'orderby' => 'ID', 'order' => 'ASC' ) );
  foreach ( $posts as $p ) {
    $out[] = array(
      'id'      => (int) $p->ID,
      'title'   => $p->post_title,
      'slug'    => $p->post_name,
      'status'  => $p->post_status,
      'items'   => fmb_items_from_blocks( parse_blocks( $p->post_content ) ),
      'content' => $p->post_content,
    );
  }
  return $out;
}

function fmb_pages() {
  $out = array();
  $pages = get_posts( array( 'post_type' => 'page', 'post_status' => array( 'publish', 'draft', 'private', 'pending', 'future' ), 'numberposts' => -1, 'orderby' => 'ID', 'order' => 'ASC' ) );
  foreach ( $pages as $p ) {
    $out[] = array( 'id' => (int) $p->ID, 'title' => $p->post_title, 'slug' => $p->post_name, 'status' => $p->post_status, 'parent' => (int) $p->post_parent );
  }
  return $out;
}

// ---------- plan: kit <nav><ul> → voci risolte ----------

function fmb_norm( $s ) {
  return mb_strtolower( trim( preg_replace( '/\s+/u', ' ', html_entity_decode( (string) $s, ENT_QUOTES | ENT_HTML5, 'UTF-8' ) ) ) );
}

function fmb_resolve_label( $label, $href, $pages, &$warnings, $menu_title ) {
  $n = fmb_norm( $label );
  if ( $n === 'home' || $href === '/' ) return array( 'label' => $label, 'home' => true );
  $published = array_filter( $pages, function ( $p ) { return $p['status'] === 'publish'; } );
  $by_title  = array_values( array_filter( $published, function ( $p ) use ( $n ) { return fmb_norm( $p['title'] ) === $n; } ) );
  if ( count( $by_title ) === 1 ) return array( 'label' => $label, 'page' => $by_title[0]['id'] );
  if ( count( $by_title ) > 1 ) {
    $warnings[] = "$menu_title › «{$label}»: più pagine pubblicate con questo titolo (id " . implode( ', ', array_column( $by_title, 'id' ) ) . ") → orfana, da scegliere";
    return array( 'label' => $label );
  }
  $slug    = sanitize_title( $label );
  $by_slug = array_values( array_filter( $published, function ( $p ) use ( $slug ) { return $p['slug'] === $slug; } ) );
  if ( count( $by_slug ) === 1 ) return array( 'label' => $label, 'page' => $by_slug[0]['id'] );
  $drafts = array_values( array_filter( $pages, function ( $p ) use ( $n ) { return $p['status'] !== 'publish' && fmb_norm( $p['title'] ) === $n; } ) );
  $hint   = $drafts ? ' (esiste come ' . $drafts[0]['status'] . ', id ' . $drafts[0]['id'] . ')' : '';
  $warnings[] = "$menu_title › «{$label}»: nessuna pagina pubblicata$hint → voce orfana (url #)";
  return array( 'label' => $label );
}

function fmb_items_from_ul( DOMElement $ul, $pages, &$warnings, $menu_title ) {
  $items = array();
  foreach ( $ul->childNodes as $li ) {
    if ( ! ( $li instanceof DOMElement ) || $li->tagName !== 'li' ) continue;
    $a = null; $sub = null;
    foreach ( $li->childNodes as $c ) {
      if ( ! ( $c instanceof DOMElement ) ) continue;
      if ( $c->tagName === 'a' && ! $a ) $a = $c;
      if ( $c->tagName === 'ul' && ! $sub ) $sub = $c;
    }
    if ( ! $a ) continue;
    $label = trim( preg_replace( '/\s+/u', ' ', $a->textContent ) );
    $item  = fmb_resolve_label( $label, trim( $a->getAttribute( 'href' ) ), $pages, $warnings, $menu_title );
    if ( $sub ) $item['children'] = fmb_items_from_ul( $sub, $pages, $warnings, $menu_title );
    $items[] = $item;
  }
  return $items;
}

function fmb_plan_from_kits( $kits ) {
  $pages    = fmb_pages();
  $warnings = array();
  $menus    = array();
  foreach ( $kits as $part => $file ) {
    if ( ! file_exists( $file ) ) fmb_err( "kit non trovato: $file" );
    $doc = new DOMDocument();
    libxml_use_internal_errors( true );
    $doc->loadHTML( '<?xml encoding="utf-8" ?><div>' . file_get_contents( $file ) . '</div>' );
    libxml_clear_errors();
    $navs = $doc->getElementsByTagName( 'nav' );
    if ( ! $navs->length ) { $warnings[] = "$part: nessun <nav> nel kit $file"; continue; }
    foreach ( $navs as $i => $nav ) {
      $ul = null;
      foreach ( $nav->childNodes as $c ) { if ( $c instanceof DOMElement && $c->tagName === 'ul' ) { $ul = $c; break; } }
      if ( ! $ul ) continue;
      $title = trim( $nav->getAttribute( 'aria-label' ) );
      if ( $title === '' ) $title = 'Menu ' . $part;
      $items = fmb_items_from_ul( $ul, $pages, $warnings, $title );
      $sig   = json_encode( $items );
      $merged = false;
      foreach ( $menus as &$m ) {
        if ( $m['_sig'] === $sig ) { $m['parts'][] = $part; $m['aria'][ $part ] = $title; $merged = true; break; }
      }
      unset( $m );
      if ( ! $merged ) $menus[] = array( 'title' => $title, 'parts' => array( $part ), 'aria' => array( $part => $title ), 'items' => $items, '_sig' => $sig );
    }
  }
  foreach ( $menus as &$m ) { unset( $m['_sig'] ); $m['parts'] = array_values( array_unique( $m['parts'] ) ); }
  unset( $m );
  return array( 'menus' => $menus, 'warnings' => $warnings );
}

// ---------- apply ----------

function fmb_serialize_items( $items ) {
  $lines = array();
  foreach ( $items as $it ) {
    $children = ! empty( $it['children'] ) ? $it['children'] : array();
    if ( ! empty( $it['home'] ) ) {
      $lines[] = '<!-- wp:home-link ' . serialize_block_attributes( array( 'label' => $it['label'] ) ) . ' /-->';
      continue;
    }
    if ( ! empty( $it['page'] ) && get_post_status( (int) $it['page'] ) === 'publish' ) {
      $attrs = array( 'label' => $it['label'], 'type' => 'page', 'id' => (int) $it['page'], 'url' => get_permalink( (int) $it['page'] ), 'kind' => 'post-type' );
    } else {
      $attrs = array( 'label' => $it['label'], 'url' => isset( $it['url'] ) ? $it['url'] : '#', 'kind' => 'custom' );
    }
    if ( $children ) {
      $lines[] = '<!-- wp:navigation-submenu ' . serialize_block_attributes( $attrs ) . ' -->';
      $lines[] = fmb_serialize_items( $children );
      $lines[] = '<!-- /wp:navigation-submenu -->';
    } else {
      $lines[] = '<!-- wp:navigation-link ' . serialize_block_attributes( $attrs ) . ' /-->';
    }
  }
  return implode( "\n", $lines );
}

function fmb_find_navigation( $menu, $part_navs ) {
  foreach ( $menu['parts'] as $part ) {
    $blocks = isset( $part_navs[ $part ] ) ? $part_navs[ $part ] : array();
    $i      = fmb_pick_nav_block( $blocks, isset( $menu['aria'][ $part ] ) ? $menu['aria'][ $part ] : null );
    if ( $i !== null && ! empty( $blocks[ $i ]['ref'] ) ) {
      $p = get_post( (int) $blocks[ $i ]['ref'] );
      if ( $p && $p->post_type === 'wp_navigation' ) return $p;
    }
  }
  $by_title = get_posts( array( 'post_type' => 'wp_navigation', 'post_status' => 'any', 'numberposts' => 1, 'title' => $menu['title'] ) );
  return $by_title ? $by_title[0] : null;
}

function fmb_print_diff( $old, $new ) {
  $o = explode( "\n", trim( (string) $old ) );
  $n = explode( "\n", trim( (string) $new ) );
  $max = max( count( $o ), count( $n ) );
  for ( $i = 0; $i < $max; $i++ ) {
    $a = isset( $o[ $i ] ) ? $o[ $i ] : null;
    $b = isset( $n[ $i ] ) ? $n[ $i ] : null;
    if ( $a === $b ) continue;
    if ( $a !== null ) echo "  - $a\n";
    if ( $b !== null ) echo "  + $b\n";
  }
}

function fmb_set_ref( $file, $id, $aria ) {
  if ( ! file_exists( $file ) ) return "assente ($file)";
  $html  = file_get_contents( $file );
  if ( ! preg_match_all( '/<!-- wp:navigation (\{.*?\}) \/?-->/s', $html, $all ) ) return 'nessun blocco navigation';
  $blocks = array();
  foreach ( $all[1] as $json ) {
    $attrs    = json_decode( $json, true );
    $blocks[] = array( 'ariaLabel' => is_array( $attrs ) && isset( $attrs['ariaLabel'] ) ? $attrs['ariaLabel'] : null );
  }
  $target = fmb_pick_nav_block( $blocks, $aria );
  if ( $target === null ) {
    fmb_err( basename( $file ) . ': ' . count( $blocks ) . " blocchi navigation e nessuno con ariaLabel \"$aria\" (il <nav> del kit e il blocco della part devono avere lo stesso aria-label)" );
  }
  $index = 0;
  $next  = preg_replace_callback( '/(<!-- wp:navigation )(\{.*?\})( \/?-->)/s', function ( $m ) use ( $id, $target, &$index ) {
    if ( $index++ !== $target ) return $m[0];
    $json = $m[2];
    if ( preg_match( '/"ref":\s*\d+/', $json ) ) {
      $json = preg_replace( '/"ref":\s*\d+/', '"ref":' . $id, $json, 1 );
    } elseif ( $json === '{}' ) {
      $json = '{"ref":' . $id . '}';
    } else {
      $json = '{"ref":' . $id . ',' . substr( $json, 1 );
    }
    return $m[1] . $json . $m[3];
  }, $html );
  if ( $next === $html ) return "ref $id già presente" . ( $aria !== null && count( $blocks ) > 1 ? " (blocco \"$aria\")" : '' );
  file_put_contents( $file, $next );
  return "ref → $id scritto" . ( $aria !== null && count( $blocks ) > 1 ? " (blocco \"$aria\")" : '' );
}

// ---------- main ----------

if ( $fmb_mode === 'dump' ) {
  $navs  = fmb_part_navs( fmb_parts_dir() );
  $first = array();
  foreach ( $navs as $part => $blocks ) $first[ $part ] = $blocks ? $blocks[0]['ref'] : null;
  fmb_json( array(
    'parts'             => $first,
    'navigation_blocks' => $navs,
    'navigations' => fmb_navigations(),
    'pages'       => fmb_pages(),
    'front_page'  => get_option( 'show_on_front' ) === 'page' ? (int) get_option( 'page_on_front' ) : null,
  ) );
  fmb_halt( 0 );
}

if ( $fmb_mode === 'plan' ) {
  $kits = array();
  foreach ( array_slice( $fmb_args, 1 ) as $arg ) {
    if ( ! preg_match( '/^([a-z0-9_-]+)=(.+)$/i', $arg, $m ) ) fmb_err( "argomento non valido: $arg (atteso part=<file.kit>)" );
    $kits[ $m[1] ] = $m[2];
  }
  if ( ! $kits ) fmb_err( 'uso: plan header=<kit> [footer=<kit> …]' );
  $plan = fmb_plan_from_kits( $kits );
  foreach ( $plan['warnings'] as $w ) fwrite( STDERR, "avviso: $w\n" );
  fmb_json( $plan );
  fmb_halt( 0 );
}

if ( $fmb_mode === 'apply' ) {
  $plan_file = isset( $fmb_args[1] ) ? $fmb_args[1] : '';
  $confirm   = false;
  $parts_dir = '';
  foreach ( array_slice( $fmb_args, 2 ) as $arg ) {
    if ( $arg === 'confirm' ) { $confirm = true; continue; }
    if ( strpos( $arg, 'parts=' ) === 0 ) { $parts_dir = substr( $arg, 6 ); continue; }
    fmb_err( "argomento non valido: $arg (ammessi: confirm, parts=<dir>)" );
  }
  $plan = $plan_file && file_exists( $plan_file ) ? json_decode( file_get_contents( $plan_file ), true ) : null;
  if ( ! is_array( $plan ) || empty( $plan['menus'] ) ) fmb_err( "piano non leggibile: $plan_file" );

  $dir       = fmb_parts_dir( $parts_dir );
  $part_navs = fmb_part_navs( $dir );
  $pending   = array();
  $ops       = array();

  // 1. confronto: niente viene scritto finché ogni differenza non è confermata
  foreach ( $plan['menus'] as $menu ) {
    if ( empty( $menu['title'] ) || empty( $menu['parts'] ) || ! isset( $menu['items'] ) ) fmb_err( 'ogni menu del piano richiede title, parts, items' );
    $content  = fmb_serialize_items( $menu['items'] );
    $existing = fmb_find_navigation( $menu, $part_navs );
    if ( $existing && trim( $existing->post_content ) !== trim( $content ) ) {
      echo "{$menu['title']} (id {$existing->ID}): differenze kit → WP\n";
      fmb_print_diff( $existing->post_content, $content );
      $pending[] = $menu['title'];
    }
    $ops[] = array( 'menu' => $menu, 'content' => $content, 'existing' => $existing );
  }
  if ( $pending && ! $confirm ) {
    echo "\nNessuna scrittura: mostra il diff al dev e, solo dopo la sua conferma in un turno successivo, rilancia con `confirm`.\n";
    fmb_halt( 3 );
  }

  // 2. scrittura
  foreach ( $ops as $op ) {
    $menu = $op['menu'];
    if ( $op['existing'] ) {
      $id = (int) $op['existing']->ID;
      if ( trim( $op['existing']->post_content ) === trim( $op['content'] ) ) {
        echo "{$menu['title']} (id $id): 0 differenze\n";
      } else {
        $r = wp_update_post( array( 'ID' => $id, 'post_content' => $op['content'] ), true );
        if ( is_wp_error( $r ) ) fmb_err( 'update fallito: ' . $r->get_error_message() );
        echo "{$menu['title']} (id $id): aggiornato\n";
      }
    } else {
      $id = wp_insert_post( array( 'post_type' => 'wp_navigation', 'post_status' => 'publish', 'post_title' => $menu['title'], 'post_content' => $op['content'] ), true );
      if ( is_wp_error( $id ) ) fmb_err( 'creazione fallita: ' . $id->get_error_message() );
      echo "{$menu['title']} (id $id): creato\n";
    }
    foreach ( $menu['parts'] as $part ) {
      $aria = isset( $menu['aria'][ $part ] ) ? $menu['aria'][ $part ] : null;
      echo "  parts/$part.html: " . fmb_set_ref( "$dir/$part.html", $id, $aria ) . "\n";
    }
  }
  fmb_halt( 0 );
}

fmb_err( 'uso: dump | plan part=<kit> … | apply <plan.json> [confirm] [parts=<dir>]' );
