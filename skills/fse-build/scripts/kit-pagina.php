<?php
/**
 * fse-build — ciò che kit-pagina.js chiede a WordPress per scrivere il file di blocchi di una
 * pagina. Legge e basta: non scrive mai. Lo lancia kit-pagina.js con WP-CLI:
 *
 *   {wp-cli} eval-file kit-pagina.php <richiesta.json>
 *
 * Richiesta: { immagini: [file], post: [titolo], form: [chiave], pagina: slug|ID|percorso|"" }.
 * Risposta, JSON sull'ultima riga:
 *   immagini  file → { id, url }      l'allegato nato da un file con quel nome, estensione compresa
 *                                      (WordPress può avergli aggiunto -1, -2… o -scaled)
 *   post      titolo → { id, tipo }   il contenuto pubblicato con quel titolo, poi con quello slug
 *   form      chiave → id             il form di Formidable con quella chiave (0 se non c'è)
 *   pagina    [{ chiave, figli: [{ postId, postType }] }]   i blocchi di primo livello della
 *             pagina già costruita: servono alle card segnaposto, che tengono il post che hanno
 *   ultimo    { id, tipo } | null     l'articolo pubblicato più recente
 * Ciò che non si trova manca dalla risposta: decide kit-pagina.js cosa farne.
 */

if ( ! defined( 'ABSPATH' ) ) {
  fwrite( STDERR, "Eseguire con: {wp-cli} eval-file kit-pagina.php <richiesta.json>\n" );
  exit( 2 );
}

$fkp_file = isset( $args[0] ) ? $args[0] : '';
$fkp_req  = $fkp_file !== '' && file_exists( $fkp_file ) ? json_decode( file_get_contents( $fkp_file ), true ) : null;
if ( ! is_array( $fkp_req ) ) {
  fwrite( STDERR, "kit-pagina: richiesta non leggibile: $fkp_file\n" );
  WP_CLI::halt( 2 );
}

$fkp_out = array( 'immagini' => array(), 'post' => array(), 'form' => array(), 'pagina' => array(), 'ultimo' => null );

foreach ( (array) ( $fkp_req['immagini'] ?? array() ) as $file ) {
  // Per file, non per nome: placeholder.png non è l'allegato di placeholder.jpg.
  $wanted = '/^' . preg_quote( pathinfo( $file, PATHINFO_FILENAME ), '/' ) . '(-\d+)?(-scaled)?\.' . preg_quote( pathinfo( $file, PATHINFO_EXTENSION ), '/' ) . '$/i';
  $found  = get_posts( array( 'post_type' => 'attachment', 'post_status' => 'inherit', 'numberposts' => -1, 'orderby' => 'ID', 'order' => 'ASC', 'meta_query' => array( array( 'key' => '_wp_attached_file', 'value' => pathinfo( $file, PATHINFO_FILENAME ), 'compare' => 'LIKE' ) ) ) );
  foreach ( $found as $attachment ) {
    if ( ! preg_match( $wanted, wp_basename( (string) get_post_meta( $attachment->ID, '_wp_attached_file', true ) ) ) ) continue;
    $fkp_out['immagini'][ $file ] = array( 'id' => $attachment->ID, 'url' => wp_get_attachment_url( $attachment->ID ) );
    break;
  }
}

// Solo contenuti che hanno una pagina loro: gli stessi tipi che il blocco accetta.
$fkp_types = array_values( array_diff( get_post_types( array( 'public' => true ) ), array( 'attachment' ) ) );
foreach ( (array) ( $fkp_req['post'] ?? array() ) as $title ) {
  $found = get_posts( array( 'post_type' => $fkp_types, 'post_status' => 'publish', 'title' => $title, 'numberposts' => 1, 'orderby' => 'ID', 'order' => 'ASC' ) );
  if ( ! $found ) $found = get_posts( array( 'post_type' => $fkp_types, 'post_status' => 'publish', 'name' => sanitize_title( $title ), 'numberposts' => 1, 'orderby' => 'ID', 'order' => 'ASC' ) );
  if ( $found ) $fkp_out['post'][ $title ] = array( 'id' => $found[0]->ID, 'tipo' => $found[0]->post_type );
}

foreach ( (array) ( $fkp_req['form'] ?? array() ) as $key ) {
  $id = class_exists( 'FrmForm' ) ? (int) FrmForm::get_id_by_key( $key ) : 0;
  if ( $id ) $fkp_out['form'][ $key ] = $id;
}

$fkp_ref  = (string) ( $fkp_req['pagina'] ?? '' );
$fkp_page = null;
if ( $fkp_ref !== '' ) {
  if ( ctype_digit( $fkp_ref ) ) {
    $fkp_page = get_post( (int) $fkp_ref );
  } else {
    $fkp_page = get_page_by_path( $fkp_ref, OBJECT, 'page' );
    if ( ! $fkp_page && strpos( $fkp_ref, '/' ) === false ) {
      $found    = get_posts( array( 'post_name__in' => array( $fkp_ref ), 'post_type' => 'page', 'post_status' => 'any', 'numberposts' => 1 ) );
      $fkp_page = $found ? $found[0] : null;
    }
  }
}
if ( $fkp_page && $fkp_page->post_type === 'page' ) {
  foreach ( parse_blocks( $fkp_page->post_content ) as $b ) {
    if ( $b['blockName'] === null ) continue;
    $children = array();
    foreach ( (array) $b['innerBlocks'] as $c ) {
      $children[] = array( 'postId' => (int) ( $c['attrs']['postId'] ?? 0 ), 'postType' => (string) ( $c['attrs']['postType'] ?? 'post' ) );
    }
    $fkp_out['pagina'][] = array( 'chiave' => $b['blockName'], 'figli' => $children );
  }
}

$fkp_last = get_posts( array( 'post_type' => 'post', 'post_status' => 'publish', 'numberposts' => 1 ) );
if ( $fkp_last ) $fkp_out['ultimo'] = array( 'id' => $fkp_last[0]->ID, 'tipo' => 'post' );

echo "\n", wp_json_encode( $fkp_out, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ), "\n";
