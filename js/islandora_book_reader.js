/**
 * @file
 * IslandoraBookReader is derived from the Internet Archive BookReader class.
 */

(function ($) {

  /**
   * Constructor
   */
  IslandoraBookReader = function(settings) {
    BookReader.call(this);
    this.settings = settings;
    this.numLeafs = settings.pageCount;
    this.bookTitle = settings.label.substring(0,97) + '...';
    this.bookUrl = document.location.toString();
    this.imagesBaseURL = settings.imagesFolderUri;
    this.logoURL = '';
    this.mode = settings.mode;
    this.fullscreen = false;
    this.content_type = settings.content_type;
    this.pageProgression = settings.pageProgression;
  }

  // Inherit from Internet Archive BookReader class.
  jQuery.extend(IslandoraBookReader.prototype, BookReader.prototype);

  /**
   * For a given "accessible page index" return the page number in the book.
   *
   * For example, index 5 might correspond to "Page 1" if there is front matter such
   * as a title page and table of contents.
   * for now we just show the image number
   *
   * @param int index
   *   The index of the page.
   */
  IslandoraBookReader.prototype.getPageNum = function(index) {
    return index + 1;
  }

  /**
   * Gets the index for the given leaf number.
   *
   * @param int leafNum
   *   The leaf number.
   *
   * @return int
   *   The index of the given leaf number.
   */
  IslandoraBookReader.prototype.leafNumToIndex = function(leafNum) {
    return leafNum - 1;
  }

  /**
   * Get the structure for the given page.
   */
  IslandoraBookReader.prototype.getPage = function(index) {
    if (typeof this.settings.pages[index] != 'undefined') {
      return this.settings.pages[index];
    }
  }

  /**
   * For a given "accessible page index" return the PID of that page.
   *
   * @param int index
   *   The index of the page.
   *
   * @return string
   *   The PID the given page repersents.
   */
  IslandoraBookReader.prototype.getPID = function(index) {
    var page = this.getPage(index);
    if (typeof page != 'undefined') {
      return page.pid;
    }
  }

  /**
   * Checks to see if search is enabled.
   *
   * @return boolean
   *   true if search is enabled false otherwise.
   */
  IslandoraBookReader.prototype.searchEnabled = function() {
    return this.settings.searchUri != null;
  }

  /**
   * Get the URI to the text content for the given page object.
   * This content will be displayed in the full text modal dialog box.
   *
   * @param string pid
   *   The page object to fetch the text content from.
   *
   * @return string
   *   The URI
   */
  IslandoraBookReader.prototype.getTextURI = function (pid) {
    return this.settings.textUri.replace('PID', pid);
  }

  /**
   * Return which side, left or right, that a given page should be
   * displayed on.
   *
   * @see BookReader/BookReaderIA/BookReaderJSIA.php
   */
  IslandoraBookReader.prototype.getPageSide = function(index) {
    if ('rl' != this.pageProgression) {
      // If pageProgression is not set RTL we assume it is LTR
      if (0 == (index & 0x1)) {
        // Even-numbered page
        return 'R';
      }
      else {
        // Odd-numbered page
        return 'L';
      }
    }
    else {
      // RTL
      if (0 == (index & 0x1)) {
        return 'L';
      }
      else {
        return 'R';
      }
    }
  }

  /**
   * This function returns the left and right indices for the user-visible
   * spread that contains the given index.  The return values may be
   * null if there is no facing page or the index is invalid.
   */
  IslandoraBookReader.prototype.getSpreadIndices = function(pindex) {
    var spreadIndices = [null, null];
    if ('rl' == this.pageProgression) {
      // Right to Left
      if (this.getPageSide(pindex) == 'R') {
        spreadIndices[1] = pindex;
        spreadIndices[0] = pindex + 1;
      }
      else {
        // Given index was LHS
        spreadIndices[0] = pindex;
        spreadIndices[1] = pindex - 1;
      }
    }
    else {
      // Left to right
      if (this.getPageSide(pindex) == 'L') {
        spreadIndices[0] = pindex;
        spreadIndices[1] = pindex + 1;
      }
      else {
        // Given index was RHS
        spreadIndices[1] = pindex;
        spreadIndices[0] = pindex - 1;
      }
    }
    return spreadIndices;
  }

  /**
   * Search SOLR for the given term.
   */
  IslandoraBookReader.prototype.search = function(term) {
    var url = this.settings.searchUri.replace('TERM', encodeURI(term));
    term = term.replace(/\//g, ' '); // strip slashes, since this goes in the url
    this.searchTerm = term;
    this.removeSearchResults();
    this.showProgressPopup('<img id="searchmarker" src="'+ this.imagesBaseURL + 'marker_srch-on.png'+'">' + Drupal.t('Search results will appear below ...') + '</img>');
    var that = this;
    $.ajax({url:url, dataType:'json',
            success: function(data, status, xhr) {
              that.BRSearchCallback(data);
            },
            error: function() {
              alert("Search call to " + url + " failed");
            }
           });
  }

  /**
   * Display the Search Progress
   */
  IslandoraBookReader.prototype.showProgressPopup = function(msg) {
    if (this.popup) return;
    this.popup = document.createElement("div");
    $(this.popup).css({
        top:      '-' + ($('#BookReader').height()*0.5) + 'px',
    }).attr('className', 'BRprogresspopup');
    var bar = document.createElement("div");
    $(bar).css({
        height:   '20px'
    }).attr('className', 'BRprogressbar');
    $(this.popup).append(bar);
    if (msg) {
        var msgdiv = document.createElement("div");
        msgdiv.innerHTML = msg;
        $(this.popup).append(msgdiv);
    }
    $(this.popup).appendTo('#BookReader');
  }

  /**
   * Search callback, displays results.
   */
  IslandoraBookReader.prototype.BRSearchCallback = function(results) {
    this.removeSearchResults();
    this.searchResults = results;
    if (0 == results.matches.length) {
      var errStr  = Drupal.t('No matches were found.');
      var timeout = 1000;
      if (false === results.indexed) {
        errStr  = "<p>" + Drupal.t("This @content_type hasn't been indexed for searching yet. We've just started indexing it, so search should be available soon. Please try again later. Thanks!", {'@content_type': this.content_type}) + "</p>";
        timeout = 5000;
      }
      $(this.popup).html(errStr);
      var that = this;
      setTimeout(function(){
        $(that.popup).fadeOut('slow', function() {
          that.removeProgressPopup();
        })
      },timeout);
      return;
    }
    var i;
    for (i=0; i<results.matches.length; i++) {
      this.addSearchResult(results.matches[i].text, this.leafNumToIndex(results.matches[i].par[0].page));
    }
    this.updateSearchHilites();
    this.removeProgressPopup();
  }

  /**
   * Embed code is not supported at the moment.
   */
  IslandoraBookReader.prototype.getEmbedCode = function(frameWidth, frameHeight, viewParams) {
    return Drupal.t("Embed code not currently supported.");
  }

  /**
   * Intialized the strings in the interface.
   *
   * @todo Translate these strings.
   */
  IslandoraBookReader.prototype.initUIStrings = function() {
    // Navigation handlers will be bound after all UI is in place -- makes moving icons between
    // the toolbar and nav bar easier
    // Setup tooltips -- later we could load these from a file for i18n
    var titles = {
      '.logo': Drupal.t('Go to Archive.org'), // $$$ update after getting OL record
      '.zoom_in': Drupal.t('Zoom in'),
      '.zoom_out': Drupal.t('Zoom out'),
      '.onepg': Drupal.t('One-page view'),
      '.twopg': Drupal.t('Two-page view'),
      '.thumb': Drupal.t('Thumbnail view'),
      '.print': Drupal.t('Print this page'),
      '.embed': Drupal.t('Embed BookReader'),
      '.link': Drupal.t('Link to this @content_type (and page)', {'@content_type': this.content_type}),
      '.bookmark': Drupal.t('Bookmark this page'),
      '.read': Drupal.t('Read this @content_type aloud', {'@content_type': this.content_type}),
      '.share': Drupal.t('Share this @content_type', {'@content_type': this.content_type}),
      '.info': Drupal.t('Info'),
      '.full': Drupal.t('Show fullscreen'),
      '.book_up': Drupal.t('Page up'),
      '.book_down': Drupal.t('Page down'),
      '.play': Drupal.t('Play'),
      '.pause': Drupal.t('Pause'),
      '.BOOKREADERdn': Drupal.t('Show/hide nav bar'),
      '.BOOKREADERup': Drupal.t('Show/hide nav bar'),
      '.book_top': Drupal.t('First page'),
      '.book_bottom': Drupal.t('Last page'),
      '.full_text' : Drupal.t('Full Text')
    };
    if ('rl' == this.pageProgression) {
      titles['.book_leftmost'] = Drupal.t('Last page');
      titles['.book_rightmost'] = Drupal.t('First page');
      titles['.book_left'] = Drupal.t('Next Page');
      titles['.book_right'] = Drupal.t('Previous Page');
    } else { // LTR
      titles['.book_leftmost'] = Drupal.t('First page');
      titles['.book_rightmost'] = Drupal.t('Last page');
      titles['.book_left'] = Drupal.t('Previous Page');
      titles['.book_right'] = Drupal.t('Next Page');
    }
    for (var icon in titles) {
      if (titles.hasOwnProperty(icon)) {
        $('#BookReader').find(icon).attr('title', titles[icon]);
      }
    }
  }

  /**
   * Override the default toolbar, mostly the same but some icons such as
   * full text are added.
   */
  IslandoraBookReader.prototype.initToolbar = function(mode, ui) {
    if (ui == "embed") {
      return; // No toolbar at top in embed mode
    }
    var readIcon = '';
    if (!navigator.userAgent.match(/mobile/i)) {
      readIcon = "<button class='BRicon read modal'></button>";
    }

    $("#BookReader").append(
      "<div id='BRtoolbar'>"
        +   "<span id='BRtoolbarbuttons'>"
        +     "<form  id='booksearch'><input type='search' id='textSrch' name='textSrch' val='' placeholder='"
        +     Drupal.t('Search inside')
        +     "'/><button type='submit' id='btnSrch' name='btnSrch'>" + Drupal.t('GO') + "</button></form>"
        +     "<button class='BRicon play'></button>"
        +     "<button class='BRicon pause'></button>"
        +     "<button class='BRicon info'></button>"
        +     "<button class='BRicon full_text'></buttion>"
        +     "<button class='BRicon full'></button>"
        +     "<button class='BRicon share'></button>"
        +     readIcon
        +   "</span>"
        +   "<span><a class='logo' href='" + this.logoURL + "'></a></span>"
        +   "<span id='BRreturn'><a></a></span>"
        +   "<div id='BRnavCntlTop' class='BRnabrbuvCntl'></div>"
        + "</div>"
    );
    // Attach submit handler to form.
    var that = this;
    $('#BRtoolbarbuttons > form').submit(function(event) {
      event.preventDefault();
      that.search($('#textSrch').val());
      return false;
    });
    // Browser hack - bug with colorbox on iOS 3 see https://bugs.launchpad.net/bookreader/+bug/686220
    if ( navigator.userAgent.match(/ipad/i) && $.browser.webkit && (parseInt($.browser.version, 10) <= 531) ) {
      $('#BRtoolbarbuttons .info').hide();
      $('#BRtoolbarbuttons .share').hide();
    }

    $('#BRreturn a').attr('href', this.bookUrl).text(this.bookTitle);

    $('#BRtoolbar .BRnavCntl').addClass('BRup');
    $('#BRtoolbar .pause').hide();

    this.updateToolbarZoom(this.reduce); // Pretty format

    if (ui == "embed" || ui == "touch") {
      $("#BookReader a.logo").attr("target","_blank");
    }

    // $$$ turn this into a member variable
    var jToolbar = $('#BRtoolbar'); // j prefix indicates jQuery object

    // We build in mode 2
    jToolbar.append();

    // Hide mode buttons and autoplay if 2up is not available
    // $$$ if we end up with more than two modes we should show the applicable buttons
    if ( !this.canSwitchToMode(this.constMode2up) ) {
      jToolbar.find('.two_page_mode, .play, .pause').hide();
    }
    if ( !this.canSwitchToMode(this.constModeThumb) ) {
      jToolbar.find('.thumbnail_mode').hide();
    }

    // Hide one page button if it is the only mode available
    if ( !(this.canSwitchToMode(this.constMode2up) || this.canSwitchToMode(this.constModeThumb)) ) {
      jToolbar.find('.one_page_mode').hide();
    }

    var overlayOpacity = Drupal.settings.islandoraInternetArchiveBookReader.overlayOpacity;
    // $$$ Don't hardcode ids
    var self = this;
    jToolbar.find('.share').colorbox({inline: true, opacity: overlayOpacity, href: "#BRshare", onLoad: function() {
      self.autoStop(); self.ttsStop();
      $('#colorbox').draggable({
        cancel: '.BRfloat > :not(.BRfloatHead)'
      });
    }});
    jToolbar.find('.info').colorbox({inline: true, opacity: overlayOpacity, href: "#BRinfo", onLoad: function() {
      self.autoStop(); self.ttsStop();
      $('#colorbox').draggable({
        cancel: '.BRfloat > :not(.BRfloatHead)'
      });
    }});
    jToolbar.find('.full_text').colorbox({inline: true, opacity: overlayOpacity, href: "#BRfulltext", onLoad: function() {
      self.autoStop(); self.ttsStop();
      $('#colorbox').draggable({
        cancel: '.BRfloat > :not(.BRfloatHead)'
      });
      self.buildFullTextDiv($('#BRfulltext'));
    }});

    jToolbar.find('.full').bind('click', function() {
      self.toggleFullScreen();
    });

    $(window).keyup(function(e) {
      if(e.keyCode == 27 && self.fullscreen) {
        self.toggleFullScreen();
      }
    });

    $('<div style="display: none;"></div>').append(this.blankShareDiv()).append(this.blankInfoDiv()).append(this.blankFullTextDiv()).appendTo($('body'));
    $('#BRinfo .BRfloatTitle a').attr( {'href': this.bookUrl} ).text(this.bookTitle).addClass('title');
    this.buildInfoDiv($('#BRinfo'));
    this.buildShareDiv($('#BRshare'));
  }

  IslandoraBookReader.prototype.initNavbar = function() {
   BookReader.prototype.initNavbar.call(this);
    // Normally this would go into main init just after 
    // the navbar is created, but that would imply
    // rewriting current old init().
   this.resizeBRcontainer();
  }




  /**
   * Window resize event callback, handles admin menu
   * in Drupal.
   */
  IslandoraBookReader.prototype.windowResize = function() {
    if (this.fullscreen && $("#admin-menu").length) {
      var top = 0;
      var height = '100%';
      var admin_bar_height = $("#admin-menu").height();
      top = admin_bar_height + "px";
      height = ($(window).height() - admin_bar_height) + "px";
      this.resetReaderSizeAndStyle(height, top);
    }
  }

  /**
   * Adjust the book viewer required styles in fullscreen.
   */
  IslandoraBookReader.prototype.resetReaderSizeAndStyle = function(height, top) {
    $('div#book-viewer, .ia-bookreader').css({
      'position': 'fixed',
      'width': '100%',
      'height': height,
      'left': '0',
      'top': top,
      'z-index': '700'
    });
    this.realignPages();
  }

  /**
   * Resizes the inner container to fit within the visible space.
   * 
   * Prevents the top toolbar and bottom navbar from clipping the visible book.
   * Function mostly borrowed from 3.18 to maintain consistency.
   */ 
  IslandoraBookReader.prototype.resizeBRcontainer = function() {
    $('#BRcontainer').css({
      top: offset,
      bottom:  this.getToolBarHeight(),
      'margin-bottom': parseInt($('#BRtoolbar').css('top'))
    });
  }
  
 /** 
  * Function borrowed from 3.18 to make maintain consistency. 
  */ 
  IslandoraBookReader.prototype.getToolBarHeight = function() {
    return ($('#BRtoolbar').outerHeight() + parseInt($('#BRtoolbar').css('top')));
  }

  /**
   * Function borrowed from 3.18 to make maintain consistency. 
   */
  IslandoraBookReader.prototype.getNavHeight = function() {
    var outerHeight = $('#BRnav').outerHeight();
    var bottom = parseInt($('#BRnav').css('bottom'));
    if (!isNaN(outerHeight) && !isNaN(bottom)) {
      return outerHeight + bottom;
    }
  return 0;
  }

  /**
   * Realign the readers contents, dependant on its current state
   * (ex: fullscreen).
   */
  IslandoraBookReader.prototype.realignPages = function() {
    $('div#BookReader').css({
      'height': '100%'
    });
    var br_top = '0';
    if (this.fullscreen) {
      br_top = $('div#BRtoolbar').height() + 5;
    }
    br_top += 'px';
    $('div#BRcontainer').css({
      'height':'100%',
      'top':br_top
    });
    //this little hack re-centers the pages
    this.zoom(1);
    this.zoom(2);
  }

  /**
   * Toggle fullscreen viewer.
   */
  IslandoraBookReader.prototype.toggleFullScreen = function() {
    this.fullscreen = (this.fullscreen ? false : true);
    if(this.fullscreen) {
      var top = 0;
      var height = '100%';
      // Account for the admin menu.
      if ($("#admin-menu").length) {
        var admin_bar_height = $("#admin-menu").height();
        top = admin_bar_height + "px";
        height = ($(window).height() - admin_bar_height) + "px";
      }
      this.resetReaderSizeAndStyle(height, top);
      $('div#BookReader').css({
        'height': '100%'
      });
      // Push it down.
      $('div#BRnav').css({'margin-top':'-40px'});
    }
    else {
      $('div#book-viewer, .ia-bookreader').css({
      'position': 'relative',
      'z-index': '0'
      });
      // really? Fixed to 680px everywhere    
      $('div#BookReader, div#BRcontainer').css({
        'height': '680px'
      });
	  $('div#BRnav').css({'margin-top':'0px'});
      this.resize();
      this.zoom(1);
      this.zoom(2);
    }
  }

  /**
   * Go Fullscreen regardless of current state.
   */
  IslandoraBookReader.prototype.goFullScreen = function() {
    this.fullscreen = true;
    $('div#book-viewer, .ia-bookreader').css({
      'position': 'fixed',
      'width': '100%',
      'height': '100%',
      'left': '0',
      'top': '0',
      'z-index': '700'
    });
    $('div#BRnav').css({'margin-top':'-40px'});
    $('div#BookReader, div#BRcontainer').css({
      'height': '100%'
    });
    //this little hack re-centers the pages
    this.zoom(1);
    this.zoom(2);
  }

  /**
   * The default look of the "Info" modal dialog box.
   */
  IslandoraBookReader.prototype.blankInfoDiv = function() {
    return $([
      '<div class="BRfloat" id="BRinfo">',
            '<div class="BRfloatHead">' + Drupal.t('About this @content_type', {'@content_type': this.content_type}),
                '<a class="floatShut" href="javascript:;" onclick="Drupal.settings.islandoraInternetArchiveBookReader_jQuery.fn.colorbox.close();"><span class="shift">' + Drupal.t('Close') + '</span></a>',
            '</div>',
      '</div>'].join('\n'));
  }

  /**
   * The default look of the "Full Text" modal dialog box.
   */
  IslandoraBookReader.prototype.blankFullTextDiv = function() {
     return $([
        '<div class="BRfloat" id="BRfulltext">',
            '<div class="BRfloatHead">Text View',
                '<a class="floatShut" href="javascript:;" onclick="Drupal.settings.islandoraInternetArchiveBookReader_jQuery.fn.colorbox.close();"><span class="shift">' + Drupal.t('Close') + '</span></a>',
            '</div>',
            '<div class="BRfloatMeta">',
            '</div>',
            '</div>',
        '</div>'].join('\n')
    );
  }

  /**
   * The default look of the "Share" modal dialog box.
   */
  IslandoraBookReader.prototype.blankShareDiv = function() {
    return $([
      '<div class="BRfloat" id="BRshare">',
            '<div class="BRfloatHead">',
                'Share',
                '<a class="floatShut" href="javascript:;" onclick="Drupal.settings.islandoraInternetArchiveBookReader_jQuery.fn.colorbox.close();"><span class="shift">' + Drupal.t('Close') + '</span></a>',
            '</div>',
      '</div>'].join('\n'));
  }

  /**
   * Appends content onto the "Info" module dialog box.
   */
  IslandoraBookReader.prototype.buildInfoDiv = function(jInfoDiv) {
    $(this.settings.info).appendTo(jInfoDiv);
  }

  /**
   * Appends content onto the "Share" module dialog box.
   */
  IslandoraBookReader.prototype.buildShareDiv = function(jShareDiv) {
    var pageView = document.location + '';
    var bookView = (pageView + '').replace(/#.*/,'');
    var self = this;
    var jForm = $([
        '<p>' + Drupal.t('Copy and paste one of these options to share this @content_type elsewhere.', {'@content_type': this.content_type}) + '</p>',
        '<form method="post" action="">',
            '<fieldset>',
                '<label for="pageview">' + Drupal.t('Link to this page view:') + '</label>',
                '<input type="text" name="pageview" id="pageview" value="' + pageView + '"/>',
            '</fieldset>',
            '<fieldset>',
                '<label for="booklink">' + Drupal.t('Link to the @content_type:', {'@content_type': this.content_type}) + '</label>',
                '<input type="text" name="booklink" id="booklink" value="' + bookView + '"/>',
            '</fieldset>',
            '<fieldset class="center">',
                '<button type="button" onclick="Drupal.settings.islandoraInternetArchiveBookReader_jQuery.fn.colorbox.close();">' + Drupal.t('Finished') + '</button>',
            '</fieldset>',
        '</form>'].join('\n'));

    jForm.appendTo(jShareDiv);

    jForm.find('input').bind('change', function() {
        var form = $(this).parents('form:first');
        var params = {};
        params.mode = $(form.find('input[name=pages]:checked')).val();
        if (form.find('input[name=thispage]').attr('checked')) {
            params.page = self.getPageNum(self.currentIndex());
        }

        // $$$ changeable width/height to be added to share UI
        var frameWidth = "480px";
        var frameHeight = "430px";
        form.find('.BRframeEmbed').val(self.getEmbedCode(frameWidth, frameHeight, params));
    })
    jForm.find('input[name=thispage]').trigger('change');
    jForm.find('input, textarea').bind('focus', function() {
      this.select();
    });
    jForm.appendTo(jShareDiv);
    jForm = ''; // closure
  }

  /**
   * Appends content onto the "FullText" module dialog box.
   */
  IslandoraBookReader.prototype.buildFullTextDiv = function(jFullTextDiv) {
    jFullTextDiv.find('.BRfloatMeta').height(600);
    jFullTextDiv.find('.BRfloatMeta').width(600);
    if (1 == this.mode) {
      // Recent fix to correct issue with 2 page books
      var hash_arr = this.oldLocationHash.split("/");
      var index = hash_arr[1];
      var pid = this.getPID(index-1);
      $.get(this.getTextURI(pid),
            function(data) {
              jFullTextDiv.find('.BRfloatMeta').html(data);
            });
    } else if (3 == this.mode) {
      jFullTextDiv.find('.BRfloatMeta').html('<div>' + Drupal.t('Full text not supported for this view.') + '</div>');
    } else {
      var twoPageText = $([
      '<div class="textTop">',
         '<div class="textLeft"></div>',
         '<div class="textRight"></div>',
      '</div>'].join('\n'));
      jFullTextDiv.find('.BRfloatMeta').html(twoPageText);
      var indices = this.getSpreadIndices(this.currentIndex());
      var left_pid = this.getPID(indices[0]);
      var right_pid = this.getPID(indices[1]);
      if(left_pid) {
        $.get(this.getTextURI(left_pid),
              function(data) {
                jFullTextDiv.find('.textLeft').html(data);
              });
      }
      if(right_pid) {
        $.get(this.getTextURI(right_pid),
              function(data) {
                jFullTextDiv.find('.textRight').html(data);
              });
      }
    }
  }

  /**
   * This call back bind's handlers to various controls in the viewer. Performs
   * the default behaviour and add an additional navigation handler that hides
   * the viewer's toolbars, but otherwise allows tooltips to appear outside the
   * interface.
   */
  IslandoraBookReader.prototype.bindNavigationHandlers = function() {
    var that = this;
    BookReader.prototype.bindNavigationHandlers.call(this);
    
    // The whole click mechanic is from the 80's
    $('.BRnavCntl').unbind("click");
     
    $('.BRnavCntl').bind("click", that, function(e){
        var that = e.data;
        var shouldhappen = [];
        var first = function($offset) {
          var d1 = new $.Deferred();
          $('#BRtoolbar').animate({top:$offset}, 500, "swing", function(){console.log("should be first");d1.resolve();console.log("should be last");});
          return d1.promise();
        };
         var second = function($offset) {
          var d2 = new $.Deferred();
          $('#BRnav').animate({bottom:$offset}, function(){d2.resolve()});
          return d2.promise();
        };    
        // So sad, coding for JQUERY 1.5 in 2017!
    // So sad, coding for JQUERY 1.5 in 2017!
      if ($('#BRnavCntlBtm').hasClass('BRdn')) {
        $('#BookReader').css('overflow', 'hidden');
        
          shouldhappen.push(first(-40));
          shouldhappen.push(second(-55));

          $('#BRnavCntlBtm').addClass('BRup').removeClass('BRdn');
          $('#BRnavCntlTop').addClass('BRdn').removeClass('BRup');
          $('#BRnavCntlBtm.BRnavCntl').animate({height:'45px'});
          $('.BRnavCntl').delay(1000).animate({opacity:.25}, 1000);
        } else {
          $('#BookReader').css('overflow', 'visible');
          shouldhappen.push(first(0));
          shouldhappen.push(second(0));
          $('#BRnavCntlBtm').addClass('BRdn').removeClass('BRup');
          $('#BRnavCntlTop').addClass('BRup').removeClass('BRdn');
          $('#BRnavCntlBtm.BRnavCntl').animate({height:'30px'});
          $('.BRvavCntl').animate({opacity:1})
        };
        $.when.apply($, shouldhappen).done(function() {
         
          // Only do full resize in auto mode and need to recalc. size
          if (that.mode == that.constMode2up && that.twoPage.autofit != null && that.twoPage.autofit != 'none') {
            that.resize();
          } else if (that.mode == that.constMode1up && that.onePage.autofit != null && that.onePage.autofit != 'none') {
            that.resize();
          } else {
            // Don't do a full resize to avoid redrawing images
            that.resizeBRcontainer();
      }
    });
  }
    );
  }
  /**
   * Resize handler.
   * 
   */

  IslandoraBookReader.prototype.resize =function() {

      this.resizeBRcontainer();

      if (this.constMode1up == this.mode) {
          if (this.onePage.autofit != 'none') {
              this.resizePageView();
              this.centerPageView();
              this.updateSearchHilites(); //deletes hilights but does not call remove()
          } else {
              this.centerPageView();
              this.displayedIndices = [];
              this.updateSearchHilites(); //deletes hilights but does not call remove()
              this.drawLeafsThrottled();
          }
      } else if (this.constModeThumb == this.mode){
          this.prepareThumbnailView();
      } else {
          //console.log('drawing 2 page view');

          // We only need to prepare again in autofit (size of spread changes)
          if (this.twoPage.autofit) {
              this.prepareTwoPageView();
          } else {
              // Re-center if the scrollbars have disappeared
              var center = this.twoPageGetViewCenter();
              var doRecenter = false;
              if (this.twoPage.totalWidth < $('#BRcontainer').attr('clientWidth')) {
                  center.percentageX = 0.5;
                  doRecenter = true;
              }
              if (this.twoPage.totalHeight < $('#BRcontainer').attr('clientHeight')) {
                  center.percentageY = 0.5;
                  doRecenter = true;
              }
              if (doRecenter) {
                  this.twoPageCenterView(center.percentageX, center.percentageY);
              }
          }
      }
    }

   IslandoraBookReader.prototype.resizePageView = function() {
        switch (this.mode) {
            case this.constMode1up:
                this.resizePageView1up(); // $$$ necessary in non-1up mode?
                break;
            case this.constMode2up:
                break;
            case this.constModeThumb:
                this.prepareThumbnailView( this.currentIndex() );
                break;
            default:
                alert('Resize not implemented for this mode');
        }
    }

    // Resize the current one page view
    // Note this calls drawLeafs
    IslandoraBookReader.prototype.resizePageView1up = function() {
        // console.log('resizePageView1up');
        var i;
        var viewHeight = 0;
        //var viewWidth  = $('#BRcontainer').width(); //includes scrollBar
        var viewWidth  = $('#BRcontainer').attr('clientWidth');

        var oldScrollTop  = $('#BRcontainer').attr('scrollTop');
        //var oldScrollLeft = $('#BRcontainer').attr('scrollLeft');

        var oldPageViewHeight = $('#BRpageview').height();
        var oldPageViewWidth = $('#BRpageview').width();

        // May have come here after preparing the view, in which case the scrollTop and view height are not set

        var scrollRatio = 0;
        if (oldScrollTop > 0) {
            // We have scrolled - implies view has been set up
            var oldCenterY = this.centerY1up();
            var oldCenterX = this.centerX1up();
            scrollRatio = oldCenterY / oldPageViewHeight;
        } else {
            // Have not scrolled, e.g. because in new container

            // We set the scroll ratio so that the current index will still be considered the
            // current index in drawLeafsOnePage after we create the new view container

            // Make sure this will count as current page after resize
            // console.log('fudging for index ' + this.currentIndex() + ' (page ' + this.getPageNum(this.currentIndex()) + ')');
            var fudgeFactor = (this.getPageHeight(this.currentIndex()) / this.reduce) * 0.6;
            var oldLeafTop = this.onePageGetPageTop(this.currentIndex()) + fudgeFactor;
            var oldViewDimensions = this.onePageCalculateViewDimensions(this.reduce, this.padding);
            scrollRatio = oldLeafTop / oldViewDimensions.height;
        }

        // Recalculate 1up reduction factors
        this.onePageCalculateReductionFactors();
        // Update current reduce (if in autofit)
        if (this.onePage.autofit) {
            var reductionFactor = this.nextReduce(this.reduce, this.onePage.autofit, this.onePage.reductionFactors);
            this.reduce = reductionFactor.reduce;
        }

        var viewDimensions = this.onePageCalculateViewDimensions(this.reduce, this.padding);

        $('#BRpageview').height(viewDimensions.height);
        $('#BRpageview').width(viewDimensions.width);


        var newCenterY = scrollRatio*viewDimensions.height;
        var newTop = Math.max(0, Math.floor( newCenterY - $('#BRcontainer').height()/2 ));
        $('#BRcontainer').attr('scrollTop', newTop);

        // We use clientWidth here to avoid miscalculating due to scroll bar
        var newCenterX = oldCenterX * (viewWidth / oldPageViewWidth);
        var newLeft = newCenterX - $('#BRcontainer').attr('clientWidth') / 2;
        newLeft = Math.max(newLeft, 0);
        $('#BRcontainer').attr('scrollLeft', newLeft);
        //console.log('oldCenterX ' + oldCenterX + ' newCenterX ' + newCenterX + ' newLeft ' + newLeft);

        $('#BRpageview').empty();
        this.displayedIndices = [];
        this.drawLeafs();

        this.removeSearchHilites();
        this.updateSearchHilites();
    }  
  /**
   * Update the location hash only change it when it actually changes, as some
   * browsers can't handle that stuff.
   */
  IslandoraBookReader.prototype.updateLocationHash = function() {
    // Updated with fix to recent bug found in the Archive Viewer that
    // prevents the last page from displaying the correct transcriptions
    // or hash links.

    // Get the current page, from elements text.
    var page_string = $('#pagenum .currentpage').text();
    if (page_string) {
      var p_arr = page_string.split(" ");
      var p_index = p_arr[1];
      index = p_index;
    }
    else {
      index = 1;
    }

    var newHash = '#' + this.fragmentFromParams(this.paramsFromCurrent());
    if (page_string != this.currentIndex() && page_string) {
      var param_data = this.fragmentFromParams(this.paramsFromCurrent()).split("/");
      param_data[1] = index;
      newHash = '#' + replaceAll(',','/',param_data.toString());
    }

    // End bug fix.
    if (this.oldLocationHash != newHash) {
      window.location.hash = newHash;
    }

    // This is the variable checked in the timer.  Only user-generated changes
    // to the URL will trigger the event.
    this.oldLocationHash = newHash;
  }

  function replaceAll(find, replace, str) {
    return str.replace(new RegExp(find, 'g'), replace);
  }

  /**
   * Prepare to flip the current right page left.
   *
   * This is only overridden to deal with a bug in small books in that their css
   * properties don't get reside because the page hasn't been removed from the
   * prefetch pages list.
   */
  IslandoraBookReader.prototype.prepareFlipRightToLeft = function(nextL, nextR) {
    $(this.prefetchedImgs[nextL]).removeAttr('style');
    $(this.prefetchedImgs[nextR]).removeAttr('style');
    BookReader.prototype.prepareFlipRightToLeft.call(this, nextL, nextR);
  }
  
  // drawLeafsOnePage()
  IslandoraBookReader.prototype.drawLeafsOnePage = function() {
      //console.log('drawLeafsOnePage', this.firstIndex, this.currentIndex());
      var containerHeight = $('#BRcontainer').height();
      var scrollTop = $('#BRcontainer').attr('scrollTop');
      var scrollBottom = scrollTop + containerHeight;
      // console.log('top=' + scrollTop + ' bottom='+scrollBottom);
      //var viewWidth = $('#BRpageview').width(); //includes scroll bar width
      var viewWidth = $('#BRcontainer').attr('scrollWidth');

      var indicesToDisplay = [];

      var i;
      var leafTop = 0;
      var leafBottom = 0;
      for (i=0; i<this.numLeafs; i++) {
          var height  = parseInt(this._getPageHeight(i)/this.reduce);

          leafBottom += height;
          //console.log('leafTop = '+leafTop+ ' pageH = ' + this._getPageHeight(i) + 'leafTop>=scrollTop=' + (leafTop>=scrollTop));
          var topInView    = (leafTop >= scrollTop) && (leafTop <= scrollBottom);
          var bottomInView = (leafBottom >= scrollTop) && (leafBottom <= scrollBottom);
          var middleInView = (leafTop <=scrollTop) && (leafBottom>=scrollBottom);
          if (topInView | bottomInView | middleInView) {
              //console.log('displayed: ' + this.displayedIndices);
              //console.log('to display: ' + i);
              indicesToDisplay.push(i);
          }
          leafTop += height +10;
          leafBottom += 10;
      }

      // Based of the pages displayed in the view we set the current index
      // $$$ we should consider the page in the center of the view to be the current one
      var firstIndexToDraw  = indicesToDisplay[0];
      this.firstIndex = firstIndexToDraw;

      // Update hash, but only if we're currently displaying a leaf
      // Hack that fixes #365790
      if (this.displayedIndices.length > 0) {
          this.updateLocationHash();
      }

      if ((0 != firstIndexToDraw) && (1 < this.reduce)) {
          firstIndexToDraw--;
          indicesToDisplay.unshift(firstIndexToDraw);
      }

      var lastIndexToDraw = indicesToDisplay[indicesToDisplay.length-1];
      if ( ((this.numLeafs-1) != lastIndexToDraw) && (1 < this.reduce) ) {
          indicesToDisplay.push(lastIndexToDraw+1);
      }

      var BRpageViewEl = document.getElementById('BRpageview');

      leafTop = 0;
      var i;
      for (i=0; i<firstIndexToDraw; i++) {
          leafTop += parseInt(this._getPageHeight(i)/this.reduce) +10;
      }

      for (i=0; i<indicesToDisplay.length; i++) {
          var index = indicesToDisplay[i];
          var height  = parseInt(this._getPageHeight(index)/this.reduce);

          if (BookReader.util.notInArray(indicesToDisplay[i], this.displayedIndices)) {
              var width   = parseInt(this._getPageWidth(index)/this.reduce);
              //console.log("displaying leaf " + indicesToDisplay[i] + ' leafTop=' +leafTop);
              var div = document.createElement('div');
              div.className = 'BRpagediv1up';
              div.id = 'pagediv'+index;
              div.style.position = "absolute";
              div.style.top = leafTop + 'px';
              var left = (viewWidth-width)>>1;
              if (left<0) left = 0;
              div.style.left = left + 'px';
              div.style.width = width + 'px';
              div.style.height = height + 'px';
              //$(div).text('loading...');

              BRpageViewEl.appendChild(div);

              var img = document.createElement('img');
              img.src = this._getPageURI(index, this.reduce, 0);
              img.className = 'BRnoselect BRonePageImage';
              img.style.width = width + 'px';
              img.style.height = height + 'px';
              div.appendChild(img);
          } else {
              //console.log("not displaying " + indicesToDisplay[i] + ' score=' + jQuery.inArray(indicesToDisplay[i], this.displayedIndices));
          }

          leafTop += height +10;

      }

      for (i=0; i<this.displayedIndices.length; i++) {
          if (BookReader.util.notInArray(this.displayedIndices[i], indicesToDisplay)) {
              var index = this.displayedIndices[i];
              //console.log('Removing leaf ' + index);
              //console.log('id='+'#pagediv'+index+ ' top = ' +$('#pagediv'+index).css('top'));
              $('#pagediv'+index).remove();
          } else {
              //console.log('NOT Removing leaf ' + this.displayedIndices[i]);
          }
      }

      this.displayedIndices = indicesToDisplay.slice();
      this.updateSearchHilites();

      if (null != this.getPageNum(firstIndexToDraw))  {
          $("#BRpagenum").val(this.getPageNum(this.currentIndex()));
      } else {
          $("#BRpagenum").val('');
      }

      this.updateToolbarZoom(this.reduce);

      // Update the slider
      this.updateNavIndexThrottled();
  }

  // drawLeafsThumbnail()
  // If seekIndex is defined, the view will be drawn with that page visible (without any
  // animated scrolling)
  IslandoraBookReader.prototype.drawLeafsThumbnail = function( seekIndex ) {

      var viewWidth = $('#BRcontainer').attr('scrollWidth') - 20; // width minus buffer

      var i;
      var leafWidth;
      var leafHeight;
      var rightPos = 0;
      var bottomPos = 0;
      var maxRight = 0;
      var currentRow = 0;
      var leafIndex = 0;
      var leafMap = [];

      var self = this;

      // Will be set to top of requested seek index, if set
      var seekTop;

      // Calculate the position of every thumbnail.  $$$ cache instead of calculating on every draw
      for (i=0; i<this.numLeafs; i++) {
          leafWidth = this.thumbWidth;
          if (rightPos + (leafWidth + this.thumbPadding) > viewWidth){
              currentRow++;
              rightPos = 0;
              leafIndex = 0;
          }

          if (leafMap[currentRow]===undefined) { leafMap[currentRow] = {}; }
          if (leafMap[currentRow].leafs===undefined) {
              leafMap[currentRow].leafs = [];
              leafMap[currentRow].height = 0;
              leafMap[currentRow].top = 0;
          }
          leafMap[currentRow].leafs[leafIndex] = {};
          leafMap[currentRow].leafs[leafIndex].num = i;
          leafMap[currentRow].leafs[leafIndex].left = rightPos;

          leafHeight = parseInt((this.getPageHeight(leafMap[currentRow].leafs[leafIndex].num)*this.thumbWidth)/this.getPageWidth(leafMap[currentRow].leafs[leafIndex].num), 10);
          if (leafHeight > leafMap[currentRow].height) {
              leafMap[currentRow].height = leafHeight;
          }
          if (leafIndex===0) { bottomPos += this.thumbPadding + leafMap[currentRow].height; }
          rightPos += leafWidth + this.thumbPadding;
          if (rightPos > maxRight) { maxRight = rightPos; }
          leafIndex++;

          if (i == seekIndex) {
              seekTop = bottomPos - this.thumbPadding - leafMap[currentRow].height;
          }
      }

      // reset the bottom position based on thumbnails
      $('#BRpageview').height(bottomPos);

      var pageViewBuffer = Math.floor(($('#BRcontainer').attr('scrollWidth') - maxRight) / 2) - 14;

      // If seekTop is defined, seeking was requested and target found
      if (typeof(seekTop) != 'undefined') {
          $('#BRcontainer').scrollTop( seekTop );
      }

      var scrollTop = $('#BRcontainer').attr('scrollTop');
      var scrollBottom = scrollTop + $('#BRcontainer').height();

      var leafTop = 0;
      var leafBottom = 0;
      var rowsToDisplay = [];

      // Visible leafs with least/greatest index
      var leastVisible = this.numLeafs - 1;
      var mostVisible = 0;

      // Determine the thumbnails in view
      for (i=0; i<leafMap.length; i++) {
          leafBottom += this.thumbPadding + leafMap[i].height;
          var topInView    = (leafTop >= scrollTop) && (leafTop <= scrollBottom);
          var bottomInView = (leafBottom >= scrollTop) && (leafBottom <= scrollBottom);
          var middleInView = (leafTop <=scrollTop) && (leafBottom>=scrollBottom);
          if (topInView | bottomInView | middleInView) {
              //console.log('row to display: ' + j);
              rowsToDisplay.push(i);
              if (leafMap[i].leafs[0].num < leastVisible) {
                  leastVisible = leafMap[i].leafs[0].num;
              }
              if (leafMap[i].leafs[leafMap[i].leafs.length - 1].num > mostVisible) {
                  mostVisible = leafMap[i].leafs[leafMap[i].leafs.length - 1].num;
              }
          }
          if (leafTop > leafMap[i].top) { leafMap[i].top = leafTop; }
          leafTop = leafBottom;
      }

      // create a buffer of preloaded rows before and after the visible rows
      var firstRow = rowsToDisplay[0];
      var lastRow = rowsToDisplay[rowsToDisplay.length-1];
      for (i=1; i<this.thumbRowBuffer+1; i++) {
          if (lastRow+i < leafMap.length) { rowsToDisplay.push(lastRow+i); }
      }
      for (i=1; i<this.thumbRowBuffer+1; i++) {
          if (firstRow-i >= 0) { rowsToDisplay.push(firstRow-i); }
      }

      // Create the thumbnail divs and images (lazy loaded)
      var j;
      var row;
      var left;
      var index;
      var div;
      var link;
      var img;
      var page;
      for (i=0; i<rowsToDisplay.length; i++) {
          if (BookReader.util.notInArray(rowsToDisplay[i], this.displayedRows)) {
              row = rowsToDisplay[i];

              for (j=0; j<leafMap[row].leafs.length; j++) {
                  index = j;
                  leaf = leafMap[row].leafs[j].num;

                  leafWidth = this.thumbWidth;
                  leafHeight = parseInt((this.getPageHeight(leaf)*this.thumbWidth)/this.getPageWidth(leaf), 10);
                  leafTop = leafMap[row].top;
                  left = leafMap[row].leafs[index].left + pageViewBuffer;
                  if ('rl' == this.pageProgression){
                      left = viewWidth - leafWidth - left;
                  }

                  div = document.createElement("div");
                  div.id = 'pagediv'+leaf;
                  div.style.position = "absolute";
                  div.className = "BRpagedivthumb";

                  left += this.thumbPadding;
                  div.style.top = leafTop + 'px';
                  div.style.left = left + 'px';
                  div.style.width = leafWidth + 'px';
                  div.style.height = leafHeight + 'px';
                  //$(div).text('loading...');

                  // link to page in single page mode
                  link = document.createElement("a");
                  $(link).data('leaf', leaf);
                  link.addEventListener('mouseup', function(event) {
                    self.firstIndex = $(this).data('leaf');
                    if (self._prevReadMode !== undefined) {
                      self.switchMode(self._prevReadMode);
                    } else {
                      self.switchMode(self.constMode1up);
                    }
                    event.preventDefault();
                    event.stopPropagation();
                  }, true);
                  $(div).append(link);

                  $('#BRpageview').append(div);

                  img = document.createElement("img");
                  var thumbReduce = Math.floor(this.getPageWidth(leaf) / this.thumbWidth);

                  $(img).attr('src', this.imagesBaseURL + 'transparent.png')
                      .css({'width': leafWidth+'px', 'height': leafHeight+'px' })
                      .addClass('BRlazyload')
                      // Store the URL of the image that will replace this one
                      .data('srcURL',  this._getPageURI(leaf, thumbReduce));
                  $(link).append(img);
                  //console.log('displaying thumbnail: ' + leaf);
              }
          }
      }

      // Remove thumbnails that are not to be displayed
      var k;
      for (i=0; i<this.displayedRows.length; i++) {
          if (BookReader.util.notInArray(this.displayedRows[i], rowsToDisplay)) {
              row = this.displayedRows[i];

              // $$$ Safari doesn't like the comprehension
              //var rowLeafs =  [leaf.num for each (leaf in leafMap[row].leafs)];
              //console.log('Removing row ' + row + ' ' + rowLeafs);

              for (k=0; k<leafMap[row].leafs.length; k++) {
                  index = leafMap[row].leafs[k].num;
                  //console.log('Removing leaf ' + index);
                  $('#pagediv'+index).remove();
              }
          } else {
              // var mRow = this.displayedRows[i];
              // var mLeafs = '[' +  [leaf.num for each (leaf in leafMap[mRow].leafs)] + ']';
              // console.log('NOT Removing row ' + mRow + ' ' + mLeafs);
          }
      }

      // Update which page is considered current to make sure a visible page is the current one
      var currentIndex = this.currentIndex();
      if (currentIndex < leastVisible) {
          this.setCurrentIndex(leastVisible);
      } else if (currentIndex > mostVisible) {
          this.setCurrentIndex(mostVisible);
      }
      this.updateNavIndexThrottled();

      this.displayedRows = rowsToDisplay.slice();

      // Update hash, but only if we're currently displaying a leaf
      // Hack that fixes #365790
      if (this.displayedRows.length > 0) {
          this.updateLocationHash();
      }

      // remove previous highlights
      $('.BRpagedivthumb_highlight').removeClass('BRpagedivthumb_highlight');

      // highlight current page
      $('#pagediv'+this.currentIndex()).addClass('BRpagedivthumb_highlight');

      this.lazyLoadThumbnails();

      // Update page number box.  $$$ refactor to function
      if (null !== this.getPageNum(this.currentIndex()))  {
          $("#BRpagenum").val(this.getPageNum(this.currentIndex()));
      } else {
          $("#BRpagenum").val('');
      }

      this.updateToolbarZoom(this.reduce);
  }
  

  /**
   * Override the autoToggle function to reset back to the zero index.
   *
   * Overridden because IAV sets the index back to 1 when it should be 0.
   */
  IslandoraBookReader.prototype.autoToggle = function() {
    this.ttsStop();

    var bComingFrom1up = false;
    if (2 != this.mode) {
      bComingFrom1up = true;
      this.switchMode(2);
    }

    // Change to autofit if book is too large
    if (this.reduce < this.twoPageGetAutofitReduce()) {
      this.zoom2up('auto');
    }

    var self = this;
    if (null == this.autoTimer) {
      this.flipSpeed = 2000;

      // $$$ Draw events currently cause layout problems when they occur during animation.
      //     There is a specific problem when changing from 1-up immediately to autoplay in RTL so
      //     we workaround for now by not triggering immediate animation in that case.
      //     See https://bugs.launchpad.net/gnubook/+bug/328327
      if (('rl' == this.pageProgression) && bComingFrom1up) {
          // don't flip immediately -- wait until timer fires
      } else {
          // flip immediately
          this.flipFwdToIndex();
      }

      $('#BRtoolbar .play').hide();
      $('#BRtoolbar .pause').show();
      this.autoTimer=setInterval(function(){
        if (self.animating) {return;}

          if (Math.max(self.twoPage.currentIndexL, self.twoPage.currentIndexR) >= self.lastDisplayableIndex()) {
            self.flipBackToIndex(0); // $$$ really what we want?
          } else {
            self.flipFwdToIndex();
          }
      },5000);
    } else {
        this.autoStop();
    }
  }
})(jQuery);
