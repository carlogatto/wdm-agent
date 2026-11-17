<?php
/**
 * Fixture delle prove del plugin wdm-agent: registra nel sito di prova i tre blocchi che
 * wp-page.test.js usa, con i default da cui dipende il confronto (una variante al default può
 * mancare nel contenuto salvato). Le prove lo copiano in wp-content/mu-plugins/.
 */
add_action( 'init', function () {
  register_block_type( 'wdm/cta', array(
    'attributes' => array(
      'variant' => array( 'type' => 'string', 'default' => 'centered' ),
      'title'   => array( 'type' => 'string', 'default' => '' ),
    ),
  ) );
  register_block_type( 'wdm/hero', array(
    'attributes' => array(
      'variant' => array( 'type' => 'string', 'default' => 'image' ),
    ),
  ) );
  register_block_type( 'wdm/hero-slide', array(
    'attributes' => array(
      'title' => array( 'type' => 'string', 'default' => '' ),
    ),
  ) );
} );
