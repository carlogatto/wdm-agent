<?php
/**
 * fse-menu-build — unico write path verso i post `wp_navigation` e il `ref` dei blocchi
 * `core/navigation` nelle parts del tema. Si esegue con WP-CLI (eval-file), dalla site root:
 *
 *   {wp-cli} eval-file ${CLAUDE_PLUGIN_ROOT}/skills/fse-menu-build/scripts/wp-navigation.php dump
 *   {wp-cli} eval-file ${CLAUDE_PLUGIN_ROOT}/skills/fse-menu-build/scripts/wp-navigation.php plan header=<kit> footer=<kit> > {scratchpad}/nav-plan.json
 *   {wp-cli} eval-file ${CLAUDE_PLUGIN_ROOT}/skills/fse-menu-build/scripts/wp-navigation.php apply <plan.json> [confirm] [parts=<dir>]
 *   {wp-cli} eval-file ${CLAUDE_PLUGIN_ROOT}/skills/fse-menu-build/scripts/wp-navigation.php apply <plan.json> prova [parts=<dir>]
 *
 * dump  → JSON: ref dei blocchi navigation per part (parts/*.html), post wp_navigation con
 *         l'albero delle voci, pagine di ogni stato, pagina in front.
 * plan  → legge le `<nav><ul>` dei kit indicati (part=percorso, in ordine), risolve ogni voce
 *         a una pagina pubblicata (titolo → slug → orfana), unisce le liste identiche in un
 *         solo menu (stesso ref in più parts; `aria` = aria-label del <nav> per part, usato per
 *         scegliere il blocco navigation giusto quando una part ne ha più di uno) e stampa il
 *         piano JSON; avvisi su stderr.
 * apply → per ogni menu del piano: trova il post (ref della prima part → titolo), lo crea se
 *         manca, confronta il contenuto e stampa il diff. Aggiunte, riordini e voci che trovano
 *         la loro pagina si scrivono subito. Se WordPress perderebbe qualcosa (una voce che il
 *         piano non ha, una pagina o un indirizzo scelti a mano che il piano cambierebbe, un
 *         blocco che non è una voce) esce 3 senza scrivere, salvo `confirm`. Se il menu è aperto nell'editor da un utente esce 4 senza
 *         scrivere. Poi riscrive `"ref":N` nel blocco navigation di OGNI part elencata (core non
 *         controlla il post type del ref: un id sbagliato stampa una pagina dentro il menu).
 *         Le parts si controllano prima di scrivere: una part assente o senza il blocco giusto
 *         ferma tutto con exit 1. `parts=<dir>` sostituisce {theme-root}/parts (test, dry run).
 *         Con `prova` confronta e basta: stampa il diff di ogni menu (o «0 differenze», «da
 *         creare», «ref da scrivere» se il blocco della part non punta al menu) e non scrive
 *         mai, né un post né un ref. Una perdita o un menu aperto nell'editor qui sono solo
 *         differenze: gli exit 3 e 4 sono di `apply` che scrive. Lo usa lo script di controllo.
 *
 * Exit: 0 ok · 1 errore · 3 voci che WordPress perderebbe, in attesa di conferma · 4 menu aperto
 * nell'editor da un utente, nulla scritto · 5 solo con `prova`: almeno un menu è diverso dal
 * piano, nulla scritto.
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
// Il commento di apertura di un blocco navigation: gli attributi possono mancare
// (`<!-- wp:navigation /-->`).
const FMB_NAV = '/(<!-- wp:navigation)(?: (\{.*?\}))?( \/?-->)/s';

function fmb_part_navs( $dir ) {
  $out = array();
  foreach ( (array) glob( $dir . '/*.html' ) as $file ) {
    $part   = basename( $file, '.html' );
    $html   = file_get_contents( $file );
    $blocks = array();
    if ( preg_match_all( FMB_NAV, $html, $m ) ) {
      foreach ( $m[2] as $json ) {
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
      $title = trim( $nav->getAttribute( 'aria-label' ) );
      if ( $title === '' ) $title = 'Menu ' . $part;
      // La lista può stare dentro un contenitore (<nav><div><ul>): vale la prima che si incontra.
      $ul = $nav->getElementsByTagName( 'ul' )->item( 0 );
      if ( ! $ul ) { $warnings[] = "$title: il <nav> del kit $file non contiene una lista <ul>"; continue; }
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

// Ciò che WordPress perderebbe se il menu venisse riscritto dal piano: le voci del post che il
// piano non ha (riconosciute dall'etichetta), le voci la cui destinazione il piano cambierebbe
// (una pagina o un indirizzo scelti a mano), i blocchi che non sono voci. Un riordino,
// un'aggiunta, o una voce orfana («#») che trova la sua pagina non perdono nulla.
// Ogni voce è { label, dest, show }: dest è '' per una voce orfana.
function fmb_existing_ids( $blocks ) {
  $out = array();
  foreach ( $blocks as $b ) {
    if ( empty( $b['blockName'] ) ) continue;
    $a = isset( $b['attrs'] ) && is_array( $b['attrs'] ) ? $b['attrs'] : array();
    if ( $b['blockName'] === 'core/home-link' ) {
      $out[] = array( 'label' => fmb_norm( isset( $a['label'] ) ? $a['label'] : '' ), 'dest' => 'home', 'show' => '«' . ( isset( $a['label'] ) ? $a['label'] : '' ) . '»' );
    } elseif ( in_array( $b['blockName'], array( 'core/navigation-link', 'core/navigation-submenu' ), true ) ) {
      $label = isset( $a['label'] ) ? (string) $a['label'] : '';
      $url   = isset( $a['url'] ) ? (string) $a['url'] : '';
      $page  = isset( $a['kind'], $a['id'] ) && $a['kind'] === 'post-type' && ( ! isset( $a['type'] ) || $a['type'] === 'page' );
      $dest  = $page ? 'page:' . (int) $a['id'] : ( $url === '' || $url === '#' ? '' : $url );
      $out[] = array( 'label' => fmb_norm( $label ), 'dest' => $dest, 'show' => '«' . $label . '»' . ( $dest === '' ? '' : ' (' . ( $page ? 'pagina ' . (int) $a['id'] : $url ) . ')' ) );
    } else {
      $out[] = array( 'label' => '[' . $b['blockName'] . ']', 'dest' => 'block', 'show' => 'blocco ' . $b['blockName'] );
    }
    if ( ! empty( $b['innerBlocks'] ) ) $out = array_merge( $out, fmb_existing_ids( $b['innerBlocks'] ) );
  }
  return $out;
}

// Le voci del piano con la destinazione che fmb_serialize_items scriverà.
function fmb_plan_ids( $items ) {
  $out = array();
  foreach ( $items as $it ) {
    if ( ! empty( $it['home'] ) ) $dest = 'home';
    elseif ( ! empty( $it['page'] ) && get_post_status( (int) $it['page'] ) === 'publish' ) $dest = 'page:' . (int) $it['page'];
    else $dest = isset( $it['url'] ) && $it['url'] !== '' && $it['url'] !== '#' ? $it['url'] : '';
    $out[] = array( 'label' => fmb_norm( isset( $it['label'] ) ? $it['label'] : '' ), 'dest' => $dest );
    if ( ! empty( $it['children'] ) ) $out = array_merge( $out, fmb_plan_ids( $it['children'] ) );
  }
  return $out;
}

function fmb_lost( $existing_content, $items ) {
  $plan     = fmb_plan_ids( $items );
  $existing = fmb_existing_ids( parse_blocks( (string) $existing_content ) );
  // Prima le voci con una destinazione vera: vogliono la stessa nel piano. Poi le orfane, che
  // si accontentano di una voce del piano con la stessa etichetta.
  usort( $existing, function ( $a, $b ) { return ( $a['dest'] === '' ) <=> ( $b['dest'] === '' ); } );
  $lost = array();
  foreach ( $existing as $e ) {
    $found = null;
    foreach ( $plan as $k => $p ) {
      if ( $p['label'] !== $e['label'] ) continue;
      if ( $e['dest'] === '' || $p['dest'] === $e['dest'] ) { $found = $k; break; }
    }
    if ( $found === null ) { $lost[] = $e['show']; continue; }
    unset( $plan[ $found ] );
  }
  return $lost;
}

// Il nome dell'utente che ha il post aperto nell'editor, o '' se nessuno.
function fmb_locked_by( $post_id ) {
  if ( ! function_exists( 'wp_check_post_lock' ) ) require_once ABSPATH . 'wp-admin/includes/post.php';
  $user = wp_check_post_lock( $post_id );
  if ( ! $user ) return '';
  $data = get_userdata( $user );
  return $data ? $data->display_name : "utente $user";
}

// Il blocco navigation di una part a cui scrivere il ref: l'indice, oppure un errore in parole.
function fmb_ref_target( $file, $aria ) {
  if ( ! file_exists( $file ) ) return array( null, 'la part ' . basename( $file ) . ' non esiste' );
  if ( ! preg_match_all( FMB_NAV, file_get_contents( $file ), $all ) ) return array( null, 'la part ' . basename( $file ) . ' non ha un blocco navigation' );
  $blocks = array();
  foreach ( $all[2] as $json ) {
    $attrs    = json_decode( $json, true );
    $blocks[] = array( 'ariaLabel' => is_array( $attrs ) && isset( $attrs['ariaLabel'] ) ? $attrs['ariaLabel'] : null );
  }
  $target = fmb_pick_nav_block( $blocks, $aria );
  if ( $target === null ) {
    return array( null, basename( $file ) . ': ' . count( $blocks ) . " blocchi navigation e nessuno con ariaLabel \"$aria\" (il <nav> del kit e il blocco della part devono avere lo stesso aria-label)" );
  }
  return array( $target, count( $blocks ) > 1 && $aria !== null ? " (blocco \"$aria\")" : '' );
}

function fmb_set_ref( $file, $id, $aria ) {
  list( $target, $note ) = fmb_ref_target( $file, $aria );
  if ( $target === null ) fmb_err( $note );
  $html  = file_get_contents( $file );
  $index = 0;
  $next  = preg_replace_callback( FMB_NAV, function ( $m ) use ( $id, $target, &$index ) {
    if ( $index++ !== $target ) return $m[0];
    $json = isset( $m[2] ) ? $m[2] : '';
    if ( preg_match( '/"ref":\s*\d+/', $json ) ) {
      $json = preg_replace( '/"ref":\s*\d+/', '"ref":' . $id, $json, 1 );
    } elseif ( $json === '' || $json === '{}' ) {
      $json = '{"ref":' . $id . '}';
    } else {
      $json = '{"ref":' . $id . ',' . substr( $json, 1 );
    }
    return $m[1] . ' ' . $json . $m[3];
  }, $html );
  if ( $next === $html ) return "ref $id già presente$note";
  file_put_contents( $file, $next );
  return "ref → $id scritto$note";
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
  $dry       = false;
  $parts_dir = '';
  foreach ( array_slice( $fmb_args, 2 ) as $arg ) {
    if ( $arg === 'confirm' ) { $confirm = true; continue; }
    if ( $arg === 'prova' ) { $dry = true; continue; }
    if ( strpos( $arg, 'parts=' ) === 0 ) { $parts_dir = substr( $arg, 6 ); continue; }
    fmb_err( "argomento non valido: $arg (ammessi: confirm, prova, parts=<dir>)" );
  }
  if ( $dry && $confirm ) fmb_err( '`prova` non scrive: non va insieme a `confirm`' );
  $plan = $plan_file && file_exists( $plan_file ) ? json_decode( file_get_contents( $plan_file ), true ) : null;
  if ( ! is_array( $plan ) || empty( $plan['menus'] ) ) fmb_err( "piano non leggibile: $plan_file" );

  $dir       = fmb_parts_dir( $parts_dir );
  $part_navs = fmb_part_navs( $dir );
  $pending   = array();
  $ops       = array();

  // 1. confronto: niente viene scritto finché parts, blocchi di modifica e perdite non sono a posto
  $locked = array();
  foreach ( $plan['menus'] as $menu ) {
    if ( empty( $menu['title'] ) || empty( $menu['parts'] ) || ! isset( $menu['items'] ) ) fmb_err( 'ogni menu del piano richiede title, parts, items' );
    foreach ( $menu['parts'] as $part ) {
      list( $target, $note ) = fmb_ref_target( "$dir/$part.html", isset( $menu['aria'][ $part ] ) ? $menu['aria'][ $part ] : null );
      if ( $target === null ) fmb_err( "{$menu['title']}: $note. Nulla è stato scritto." );
    }
    $content  = fmb_serialize_items( $menu['items'] );
    $existing = fmb_find_navigation( $menu, $part_navs );
    if ( $existing && trim( $existing->post_content ) !== trim( $content ) ) {
      echo "{$menu['title']} (id {$existing->ID}): differenze kit → WP\n";
      fmb_print_diff( $existing->post_content, $content );
      $lost = fmb_lost( $existing->post_content, $menu['items'] );
      if ( $lost ) {
        echo '  WordPress perderebbe: ' . implode( ', ', $lost ) . "\n";
        $pending[] = $menu['title'];
      }
      $who = fmb_locked_by( $existing->ID );
      if ( $who !== '' ) $locked[] = "{$menu['title']} (aperto da $who)";
    }
    $ops[] = array( 'menu' => $menu, 'content' => $content, 'existing' => $existing );
  }
  if ( $dry ) {
    // Solo confronto: i menu diversi hanno già stampato il loro diff qui sopra.
    $different = 0;
    foreach ( $ops as $op ) {
      $menu = $op['menu'];
      if ( ! $op['existing'] ) {
        echo "{$menu['title']}: da creare\n";
        $different++;
        continue;
      }
      $id = (int) $op['existing']->ID;
      // Il blocco navigation di ogni part deve già puntare a questo menu: un `ref` assente o
      // diverso è ciò che `apply` scriverebbe.
      $unlinked = array();
      foreach ( $menu['parts'] as $part ) {
        $blocks = isset( $part_navs[ $part ] ) ? $part_navs[ $part ] : array();
        $i      = fmb_pick_nav_block( $blocks, isset( $menu['aria'][ $part ] ) ? $menu['aria'][ $part ] : null );
        $ref    = ( $i !== null && ! empty( $blocks[ $i ]['ref'] ) ) ? (int) $blocks[ $i ]['ref'] : 0;
        if ( $ref !== $id ) $unlinked[] = "{$menu['title']} (id $id): ref da scrivere in parts/$part.html (oggi " . ( $ref ? $ref : 'nessuno' ) . ')';
      }
      $same = trim( $op['existing']->post_content ) === trim( $op['content'] );
      if ( $same && ! $unlinked ) {
        echo "{$menu['title']} (id $id): 0 differenze\n";
        continue;
      }
      foreach ( $unlinked as $line ) echo "$line\n";
      $different++;
    }
    fmb_halt( $different ? 5 : 0 );
  }
  if ( $locked ) {
    echo "\nNessuna scrittura: menu aperto nell'editor — " . implode( ', ', $locked ) . ". Chiudi la scheda dell'editor e rilancia.\n";
    fmb_halt( 4 );
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
        // wp_update_post e wp_insert_post vogliono dati slashati (fanno wp_unslash): senza wp_slash
        // le sequenze di escape JSON degli attributi (barra + u0026 per &, barra + u0022 per ")
        // perdono la barra e la voce si corrompe.
        $r = wp_update_post( array( 'ID' => $id, 'post_content' => wp_slash( $op['content'] ) ), true );
        if ( is_wp_error( $r ) ) fmb_err( 'update fallito: ' . $r->get_error_message() );
        echo "{$menu['title']} (id $id): aggiornato\n";
      }
    } else {
      $id = wp_insert_post( wp_slash( array( 'post_type' => 'wp_navigation', 'post_status' => 'publish', 'post_title' => $menu['title'], 'post_content' => $op['content'] ) ), true );
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

fmb_err( 'uso: dump | plan part=<kit> … | apply <plan.json> [confirm | prova] [parts=<dir>]' );
