/**
 * @file
 * Defines initializing/attaching the Book Reader to the
 * defined element.
 */

(function ($) {
  Drupal.behaviors.islandoraInternetArchiveBookReader = {
    attach: function(context, settings) {
      $('.islandora-internet-archive-bookreader', context).once('islandora-bookreader', function () {
        var bookReader = null;
        if (settings.islandoraInternetArchiveBookReader.pageSource === 'djatoka') {
          bookReader = new IslandoraDjatokaBookReader(settings.islandoraInternetArchiveBookReader);
        }
        else if (settings.islandoraInternetArchiveBookReader.pageSource === 'iiif') {
          bookReader = new IslandoraIiifBookReader(settings.islandoraInternetArchiveBookReader);
        }
        // Initialize and Render the BookReader.
        bookReader.init();
        // Handle page resize, required for full screen.
        $(window).resize(function() {
          bookReader.windowResize();
        });
      // to avoid overflow icon on the bottom right side
      $('div#BRpage').css({
        'width': '300px'
      });
        // We currently don't support read-aloud.
        $('#BRtoolbar').find('.read').hide();
        if (!bookReader.searchEnabled()) {
          $('#textSrch').hide();
          $('#btnSrch').hide();
        }
        // If mobile device and mobilize the force fullscreen and mode 1
        if ($.browser.mobile && settings.islandoraInternetArchiveBookReader.mobilize) {
          bookReader.goFullScreen();
          bookReader.switchMode(1);
        }
      });
    }
  };
})(jQuery);
