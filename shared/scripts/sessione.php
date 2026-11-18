<?php
/**
 * Sessione temporanea dell'utente agente: l'agente entra nel backend senza password. La lancia
 * `sessione.js` (stessa cartella) con WP-CLI; da sola:
 *
 *   {wp-cli} eval-file ${CLAUDE_PLUGIN_ROOT}/shared/scripts/sessione.php crea   <login>
 *   {wp-cli} eval-file ${CLAUDE_PLUGIN_ROOT}/shared/scripts/sessione.php revoca <login>
 *   {wp-cli} eval-file ${CLAUDE_PLUGIN_ROOT}/shared/scripts/sessione.php stato  <login>
 *
 * crea   → chiude ogni sessione dell'utente, ne apre una di 15 minuti e stampa in JSON i cookie
 *          di accesso (quelli che WordPress darebbe dopo il login), la scadenza e l'indirizzo
 *          della bacheca. Con il sito in https i cookie sono `secure`; in http no.
 * revoca → chiude ogni sessione dell'utente e toglie i suoi blocchi di modifica (`_edit_lock`).
 *          L'utente agente è dell'agente: a lavoro finito non deve restarne nulla.
 * stato  → quante sessioni ha l'utente.
 *
 * Ogni comando stampa una riga JSON con `sessioni`. Exit: 0 ok · 1 errore (utente assente) ·
 * 2 uso.
 */

if ( ! defined( 'ABSPATH' ) ) {
  fwrite( STDERR, "uso: {wp-cli} eval-file sessione.php <crea|revoca|stato> <login>\n" );
  exit( 2 );
}

global $wpdb;
$ses_args = isset( $args ) && is_array( $args ) ? $args : array();

function ses_halt( $code ) {
  if ( class_exists( 'WP_CLI' ) ) {
    WP_CLI::halt( $code );
  }
  exit( $code );
}

function ses_err( $msg, $code = 1 ) {
  fwrite( STDERR, "sessione: $msg\n" );
  ses_halt( $code );
}

if ( count( $ses_args ) !== 2 || ! in_array( $ses_args[0], array( 'crea', 'revoca', 'stato' ), true ) ) {
  ses_err( 'uso: <crea|revoca|stato> <login>', 2 );
}
$ses_user = get_user_by( 'login', $ses_args[1] );
if ( ! $ses_user ) {
  ses_err( "in WordPress non esiste l'utente «{$ses_args[1]}» (riga {agent-admin-user} di DESIGN.md). Crealo come amministratore, oppure correggi la riga." );
}
$ses_manager = WP_Session_Tokens::get_instance( $ses_user->ID );

if ( $ses_args[0] === 'stato' ) {
  echo wp_json_encode( array( 'sessioni' => count( $ses_manager->get_all() ) ) ), "\n";
  ses_halt( 0 );
}

$ses_manager->destroy_all();
if ( $ses_args[0] === 'revoca' ) {
  // I blocchi di modifica lasciati dal browser dell'agente: Playwright chiude la scheda senza
  // avvisare l'editor, e a sessione chiusa quel blocco fermerebbe solo la build successiva.
  $ses_locks = $wpdb->get_results( $wpdb->prepare( "SELECT post_id, meta_value FROM $wpdb->postmeta WHERE meta_key = '_edit_lock' AND meta_value LIKE %s", '%:' . $ses_user->ID ) );
  foreach ( $ses_locks as $ses_lock ) {
    $ses_parts = explode( ':', $ses_lock->meta_value );
    if ( (int) end( $ses_parts ) === (int) $ses_user->ID ) delete_post_meta( (int) $ses_lock->post_id, '_edit_lock' );
  }
  echo wp_json_encode( array( 'sessioni' => count( $ses_manager->get_all() ) ) ), "\n";
  ses_halt( 0 );
}

$ses_exp    = time() + 15 * MINUTE_IN_SECONDS;
$ses_token  = $ses_manager->create( $ses_exp );
$ses_host   = wp_parse_url( home_url(), PHP_URL_HOST );
// Come wp_set_auth_cookie: bacheca in https → cookie `secure_auth`, altrimenti `auth`.
$ses_secure = 'https' === wp_parse_url( admin_url(), PHP_URL_SCHEME );
$ses_front  = $ses_secure && 'https' === wp_parse_url( home_url(), PHP_URL_SCHEME );
$ses_cookie = function ( $name, $scheme, $path, $secure ) use ( $ses_user, $ses_exp, $ses_token, $ses_host ) {
  return array(
    'name'     => $name,
    'value'    => wp_generate_auth_cookie( $ses_user->ID, $ses_exp, $scheme, $ses_token ),
    'domain'   => $ses_host,
    'path'     => $path,
    'expires'  => $ses_exp,
    'httpOnly' => true,
    'secure'   => $secure,
    'sameSite' => 'Lax',
  );
};
$ses_name   = $ses_secure ? SECURE_AUTH_COOKIE : AUTH_COOKIE;
$ses_scheme = $ses_secure ? 'secure_auth' : 'auth';
echo wp_json_encode( array(
  'cookies'  => array(
    $ses_cookie( $ses_name, $ses_scheme, ADMIN_COOKIE_PATH, $ses_secure ),
    $ses_cookie( $ses_name, $ses_scheme, PLUGINS_COOKIE_PATH, $ses_secure ),
    $ses_cookie( LOGGED_IN_COOKIE, 'logged_in', COOKIEPATH, $ses_front ),
  ),
  'scade'    => $ses_exp,
  'bacheca'  => admin_url(),
  'sessioni' => count( $ses_manager->get_all() ),
) ), "\n";
ses_halt( 0 );
