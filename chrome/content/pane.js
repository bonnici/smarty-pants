if (typeof(Cc) == 'undefined')
	var Cc = Components.classes;
if (typeof(Ci) == 'undefined')
	var Ci = Components.interfaces;
if (typeof(Cu) == 'undefined')
	var Cu = Components.utils;
if (typeof(Cr) == 'undefined')
	var Cr = Components.results;
	
Cu.import("resource://app/jsmodules/sbProperties.jsm");
Cu.import("resource://app/jsmodules/sbLibraryUtils.jsm");


if (typeof LAST_FM_ROOT_URL == 'undefined') {
  const LAST_FM_ROOT_URL = "http://ws.audioscrobbler.com/2.0/";
  const LAST_FM_API_KEY = "72b14fe3e1fd7f8ff8a993b1f1e78a50";
  const TRACK_GETSIMILAR_METHOD = "track.getSimilar";
  const ARTIST_SEARCH_METHOD = "artist.search";
  const ARTIST_GETSIMILAR_METHOD = "artist.getSimilar";
  const ARTIST_GETTOPTRACKS_METHOD = "artist.getTopTracks";
  const ARTIST_GETTOPALBUMS_METHOD = "artist.getTopAlbums";
  const REQUEST_SUCCESS_CODE = 200;
}

if (typeof SmartyPants == 'undefined') {
  var SmartyPants = {};
}

const SMARTY_PANTS_HIDDEN_PLAYLIST_PROP = "smarty-pants_hidden-playlist";
const SMARTY_PANTS_VISIBLE_PLAYLIST_PROP = "smarty-pants_visible-playlist";

/**
 * Controller for pane.xul
 */
SmartyPants.PaneController = {

  setup: function() {
    var controller = this;
    this._paneIsLoaded = false;
  
    // non-ui stuff
    this._automaticMode = false;
    this._ignoreTrackChanges = false;
    this._automaticModeHistory = {};
    this._playingAutoModePlaylist = false;
    
    this._processing = false;
    this._processingTrackOrArtist = null;
          
    this._recommendationFilterSelection = 0;
    this._numProcessed = 0;
    
    this._candidateTracks = {
      dataArray: [],
      
      addOrUpdate: function(candidateTrack, force) {
      
        if (controller._automaticMode && candidateTrack.guid != null && !force) {
          if 
          (
            controller._automaticModeHistory != null 
            && 
            controller._automaticModeHistory[candidateTrack.guid] != null
            &&
            controller._automaticModeHistory[candidateTrack.guid] == true
          ) {
            return;
          }
        }
      
        for (var index = 0; index < this.dataArray.length; index++) {
          var curTrack = this.dataArray[index];
          var tracksAreEqual = this.tracksAreEqual(curTrack, candidateTrack);
          if (tracksAreEqual) {
          
            if (candidateTrack.similarArtist != null && candidateTrack.similarArtistTopTrackScore > curTrack.similarArtistTopTrackScore) {
              curTrack.similarArtist = candidateTrack.similarArtist;
              curTrack.similarArtistTopTrackScore = candidateTrack.similarArtistTopTrackScore;
              curTrack.needsRescoring = true;
            }
            
            if (candidateTrack.relatedTo.length > 0) {
              // should only ever be 1 parent max
              curTrack.relatedTo.push({track: candidateTrack.relatedTo[0].track, score: candidateTrack.relatedTo[0].score});
              curTrack.needsRescoring = true;
            }
            
            return;
          }
        }
        
        this.dataArray.push(candidateTrack);
        return;
      },
      
      clear: function() {
        this.dataArray = [];
      },
      
      sortByScore: function() {
        this.rescore();
        this.dataArray.sort(this.sortByDiminishedScoreFunc);
      },
      
      sortByScoreFunc: function(a, b) {
        return a.score < b.score;
      },
      
      sortByDiminishedScoreFunc: function(a, b) {
        return a.diminishedScore < b.diminishedScore;
      },
      
      tracksAreEqual: function(track1, track2) {
        var tracksAreEqual = 
          track1.trackName.length == track2.trackName.length 
          && 
          track1.trackName.toLowerCase().indexOf(track2.trackName.toLowerCase()) != -1
          &&
          track1.artist.length == track2.artist.length 
          && 
          track1.artist.toLowerCase().indexOf(track2.artist.toLowerCase()) != -1;
        
        return tracksAreEqual;
      },
      
      rescore: function() {        
        var rescorer = this;
        var reScore = function (x, idx) {
          x.score = rescorer.scoreTrack(x);
        } 
        this.dataArray.forEach(reScore);
        
        if (controller._diminishTrackScores) {
          this.dataArray.sort(this.sortByScoreFunc);
          this.diminishScores(true);
        }
        else {
          this.diminishScores(false);
        }
        
        this.applyRatingModifier();
      },
      
      scoreTrack: function(track) {
      
        if (!track.needsRescoring) {
          return track.score;
        }
        
        if (track.isGettingScored) {
          return -1; // Don't infinite loop
        }
        
        if (track.artist == "Justice" && track.trackName == "Let There Be Light") {
          //alert("score 1 " + track.score);
        }
        
        if (track.seedTrack) {
          track.needsRescoring = false;
          return 1;
        }
        else {
          var similarArtistTopTrackScore = 0;
          if (track.similarArtist != null) {
            similarArtistTopTrackScore = controller._candidateArtists.getScore(track.similarArtist) * track.similarArtistTopTrackScore;
          }
          
          var similarTrackScore = 0;
          var properScoreFound = false;
          track.isGettingScored = true;
          for (var index = 0; index < track.relatedTo.length; index++) {
            var parentsScore = this.scoreTrack(track.relatedTo[index].track);
            if (parentsScore >= 0) {
              var score = (track.relatedTo[index].score / track.relatedTo[index].track.maxSimilarityScore) * parentsScore * controller._similarTrackWeight;
              
              //alert("score = (" + track.relatedTo[index].score + "/" + track.relatedTo[index].track.maxSimilarityScore + ") * " + parentsScore + "*" + controller._similarTrackWeight);
              
              properScoreFound = true;
              if (controller._ignoreDuplicateMatches) {
                if (score > similarTrackScore) {
                  similarTrackScore = score;
                }
              }
              else {
                similarTrackScore += score; 
              }
            }
          }
          track.isGettingScored = false;
          
          
          if (track.artist == "Justice" && track.trackName == "Let There Be Light") {
            //alert("score 2 " + track.score);
          }
          
          if (!properScoreFound && similarArtistTopTrackScore == 0) {
            return -1;
          }
          
          if (similarTrackScore > 0.99999) {
            similarTrackScore = 0.99999;
          }
          
          track.needsRescoring = false;
          
          if (similarTrackScore > similarArtistTopTrackScore) {
            if (track.artist == "Justice" && track.trackName == "Let There Be Light") {
              //alert("score 3 " + similarTrackScore);
            }
            
            return similarTrackScore;
          }
          else {
            if (track.artist == "Justice" && track.trackName == "Let There Be Light") {
              //alert("score 4 " + similarArtistTopTrackScore);
            }
            
            return similarArtistTopTrackScore;
          }
        }
      },
      
      diminishScores: function(actuallyDiminish) {
        var artistCounts = {};
        var diminishNumerator = controller._diminishTracksAfter;
        for (var index = 0; index < this.dataArray.length; index++) {
          curTrack = this.dataArray[index];
          
          if (actuallyDiminish) {            
            var artistCount = 0;
            if (artistCounts[curTrack.artist] != null) {
              artistCount = artistCounts[curTrack.artist];
            }
            artistCount++;
            
            if (diminishNumerator >= artistCount) {
              curTrack.diminishedScore = curTrack.score;
            }
            else {
              curTrack.diminishedScore = curTrack.score * (diminishNumerator / artistCount);
            }
            
            artistCounts[curTrack.artist] = artistCount;
          }
          else {
            curTrack.diminishedScore = curTrack.score;
          }
        }
      },
      
      applyRatingModifier: function() {
        for (var index = 0; index < this.dataArray.length; index++) {
          curTrack = this.dataArray[index];
          if (curTrack.guid != null) {
            var mediaItem = LibraryUtils.mainLibrary.getItemByGuid(curTrack.guid);
            if (mediaItem != null) {        
              var trackRating = mediaItem.getProperty(SBProperties.rating);
              
              if (trackRating == 1) {
                curTrack.diminishedScore = curTrack.diminishedScore / (1+controller._trackRatingWeight);
              }
              else if (trackRating == 2) {
                curTrack.diminishedScore = curTrack.diminishedScore / (1+(controller._trackRatingWeight/2));
              }
              else if (trackRating == 4) {
                curTrack.diminishedScore = curTrack.diminishedScore * (1+(controller._trackRatingWeight/2));
              }
              else if (trackRating == 5) {
                curTrack.diminishedScore = curTrack.diminishedScore * (1+controller._trackRatingWeight);
              }
              
              if (curTrack.diminishedScore > 1) {
                curTrack.diminishedScore = 1;
              }
            }
          }
        }
      },
    };
    
    this._candidateArtists = {
      dataArray: [],
      maxArtistSimilarTrackScore: 0,      
      
      addOrUpdate: function(candidateArtist) {
        for (var index = 0; index < this.dataArray.length; index++) {
          var curArtist = this.dataArray[index];
          var artistsAreEqual = this.artistsAreEqual(curArtist, candidateArtist);
          if (artistsAreEqual) {
            curArtist.accumulatedSimilarTrackScore += candidateArtist.accumulatedSimilarTrackScore;
            if (curArtist.accumulatedSimilarTrackScore > this.maxArtistSimilarTrackScore) {
              this.maxArtistSimilarTrackScore = curArtist.accumulatedSimilarTrackScore;
            }
            if (candidateArtist.seedArtist) {
              curArtist.seedArtist = true;
            }
            if (candidateArtist.similarityScore > curArtist.similarityScore) {
              curArtist.similarityScore = candidateArtist.similarityScore;
            }
            if (candidateArtist.imageUrl != null && curArtist.imageUrl == null) {
              curArtist.imageUrl = candidateArtist.imageUrl;
            }
            return;
          }
        }
        
        this.dataArray.push(candidateArtist);
      },
      
      getScore: function(candidateArtist) {
        if (candidateArtist.seedArtist) {
          return 1;
        }
        else {
          var artistSimilarTrackScore = candidateArtist.accumulatedSimilarTrackScore / (this.maxArtistSimilarTrackScore + 1);
          var similarArtistScore = candidateArtist.similarityScore;
          return (artistSimilarTrackScore*controller._similarArtistTrackWeight) + (similarArtistScore*controller._similarArtistSimilarityWeight);
        }
      },
            
      clear: function() {
        this.dataArray = [];
      },
      
      sortByScore: function() {
        this.dataArray.sort(this.sortByScoreFunc);
      },
      
      sortByScoreFunc: function(a, b) {
        return controller._candidateArtists.getScore(a) < controller._candidateArtists.getScore(b);
      },
      
      artistsAreEqual: function(artist1, artist2) {
        var artistsAreEqual = 
          artist1.artistName.length == artist2.artistName.length 
          && 
          artist1.artistName.toLowerCase().indexOf(artist2.artistName.toLowerCase()) != -1;
        
        return artistsAreEqual;
      }
    };
    
    
    this._trackTreeView = {  
        dataArray: [],
        rowCount: 0,
        getCellText : function(row,column) {  
          if (column.id == "track-list-title-column") return this.dataArray[row].trackName;
          else if (column.id == "track-list-artist-column") return this.dataArray[row].artistName;
          else if (column.id == "track-list-score-column") return this.dataArray[row].score;
          else return "";  
        },  
        setTree: function(treebox) { this.treebox = treebox; },  
        isContainer: function(row) { return false; },  
        isSeparator: function(row) { return false; },  
        isSorted: function() { return false; },  
        getLevel: function(row) { return 0; },  
        getImageSrc: function(row,col) { return null; },  
        getRowProperties: function(row,props) {},  
        getColumnProperties: function(colid,col,props) {}, 
        update: function(candidateTracks, reset) { 
          this.dataArray = [];
          
          if (reset) {
            controller._hiddenPlaylist.clear();
          }
          else {
            for (var indexToRemove = controller._hiddenPlaylist.length-1; indexToRemove > 0; indexToRemove--) {
              controller._hiddenPlaylist.removeByIndex(indexToRemove);
            }
          }
          
          var minScore = parseFloat(controller.getIgnoreScoresBelow());
          for (var index = 0; index < candidateTracks.dataArray.length; index++) {
            var curTrack = candidateTracks.dataArray[index];
            if (curTrack.guid != null) {
              var scoreToUse = curTrack.diminishedScore;
              if (scoreToUse >= minScore) {
                var curMediaItem = LibraryUtils.mainLibrary.getItemByGuid(curTrack.guid);
                if (curMediaItem != null) {
                  this.dataArray.push({trackName: curTrack.trackName, artistName: curTrack.artist, albumName: curTrack.album, score: scoreToUse, guid: curTrack.guid}); 
                  
                  if (reset || index > 0) {
                    controller._hiddenPlaylist.add(curMediaItem);
                  }
                }
              }
            }
          }
          
          this.dataArray.sort(this.sortByScoreFunc);
          controller._hiddenPlaylistView = controller._hiddenPlaylist.createView();
          this.rowCount = this.dataArray.length; 
        },
        
        getCellProperties: function(row,col,props) {
          if (row >= 0 && row < this.dataArray.length) {
            var curTrack = this.dataArray[row];
            if (curTrack.guid != null) {
              var curMediaItem = LibraryUtils.mainLibrary.getItemByGuid(curTrack.guid);
              if 
              (
                curMediaItem != null 
                && 
                controller._mediaCoreManager.sequencer.currentItem == curMediaItem
                && 
                controller._mediaCoreManager.sequencer.view.mediaList.getProperty(SBProperties.customType) == SMARTY_PANTS_HIDDEN_PLAYLIST_PROP
              ) {
                var aserv = Cc["@mozilla.org/atom-service;1"].getService(Ci.nsIAtomService);
                props.AppendElement(aserv.getAtom("playingSong"));
              }
            }
          }
        },
        sortByScoreFunc: function(a, b) {
          return a.score < b.score;
        },
    };
    
   this._recommendationTreeView = {  
        dataArray: [],
        rowCount: 0,
        getCellText : function(row,column) {  
          if (column.id == "recommendation-list-title-column") return this.dataArray[row].trackName;
          else if (column.id == "recommendation-list-artist-column") return this.dataArray[row].artistName;
          else if (column.id == "recommendation-list-score-column") return this.dataArray[row].score;
          else if (column.id == "recommendation-list-streamable-column") {
            if (this.dataArray[row].streamable == 1) {
              return "Yes";
            }
            else if (this.dataArray[row].streamable == 2) {
              return "Full";
            }
            else {
              return "No";
            }
          }
          else return "";  
        },  
        setTree: function(treebox) { this.treebox = treebox; },  
        isContainer: function(row) { return false; },  
        isSeparator: function(row) { return false; },  
        isSorted: function() { return false; },  
        getLevel: function(row) { return 0; },  
        getImageSrc: function(row,col) { return null; },  
        getRowProperties: function(row,props) {},  
        getCellProperties: function(row,col,props) {},  
        getColumnProperties: function(colid,col,props) {}, 
        update: function(candidateTracks) { 
          this.dataArray = [];
          var minScore = parseFloat(controller.getIgnoreScoresBelow());
          for (var index = 0; index < candidateTracks.dataArray.length; index++) {
            var curTrack = candidateTracks.dataArray[index];
            if (curTrack.guid == null) {
              var scoreToUse = curTrack.diminishedScore;
              if (scoreToUse >= minScore && curTrack.streamable >= controller._recommendationFilterSelection) {
                this.dataArray.push(
                      {
                        trackName: curTrack.trackName, 
                        artistName: curTrack.artist, 
                        albumName: curTrack.album, 
                        score: scoreToUse, 
                        streamable: curTrack.streamable, 
                        url: curTrack.url
                      }); 
              }
            }
          }
          
          this.dataArray.sort(this.sortByScoreFunc);          
          this.rowCount = this.dataArray.length; 
        },
        sortByScoreFunc: function(a, b) {
          return a.score < b.score;
        },
    };
    
    this._fixedQueryArtists = {};
    this._fixedResultArtists = {};
    this._fixedResultSongs = {};
    
    this._windowMediator = Cc["@mozilla.org/appshell/window-mediator;1"]
                            .getService(Ci.nsIWindowMediator);
                            
    this._mediaCoreManager = Cc["@songbirdnest.com/Songbird/Mediacore/Manager;1"]  
                            .getService(Components.interfaces.sbIMediacoreManager);  
                            
    this._gBrowser = this._windowMediator.getMostRecentWindow("Songbird:Main").gBrowser;
    
    // try to find an existing playlist
    this._hiddenPlaylist = null;
    try 
    {
      var itemEnum = LibraryUtils.mainLibrary.getItemsByProperty(SBProperties.customType, SMARTY_PANTS_HIDDEN_PLAYLIST_PROP).enumerate();
      if (itemEnum.hasMoreElements()) 
      {
        this._hiddenPlaylist = itemEnum.getNext();
      }
    } 
    catch (e if e.result == Cr.NS_ERROR_NOT_AVAILABLE) 
    {
      // Don't to anything - playlist will be created
    }
    
    if (this._hiddenPlaylist == null) {
      this._hiddenPlaylist = LibraryUtils.mainLibrary.createMediaList("simple");
      this._hiddenPlaylist.setProperty(SBProperties.customType, SMARTY_PANTS_HIDDEN_PLAYLIST_PROP); // Set a custom property so we know which playlist is ours
      this._hiddenPlaylist.name = "Hidden Smarty Pants Playlist";
      this._hiddenPlaylist.setProperty(SBProperties.hidden, "1");
    }
    
    this._hiddenPlaylist.setProperty(SBProperties.hidden, "1");
    
    this._hiddenPlaylistView = this._hiddenPlaylist.createView();
  },
  
  resetVisiblePlaylist: function() {
    this.clearAllTracks()
    
    // _hiddenPlaylist should be renamed
    this._hiddenPlaylist = null;
    try 
    {
      var itemEnum = LibraryUtils.mainLibrary.getItemsByProperty(SBProperties.customType, SMARTY_PANTS_VISIBLE_PLAYLIST_PROP).enumerate();
      if (itemEnum.hasMoreElements()) 
      {
        this._hiddenPlaylist = itemEnum.getNext();
      }
    } 
    catch (e if e.result == Cr.NS_ERROR_NOT_AVAILABLE) 
    {
      // Don't to anything - playlist will be created
    }
    
    if (this._hiddenPlaylist == null) {
      this._hiddenPlaylist = LibraryUtils.mainLibrary.createMediaList("simple");
      this._hiddenPlaylist.setProperty(SBProperties.customType, SMARTY_PANTS_VISIBLE_PLAYLIST_PROP); // Set a custom property so we know which playlist is ours
      this._hiddenPlaylist.name = "Smarty Pants Playlist";
      this._hiddenPlaylist.setProperty(SBProperties.hidden, "0");
    }
    
    this._hiddenPlaylistView = this._hiddenPlaylist.createView();
  },
  
  showPlaylist: function() {
    this._gBrowser.loadMediaList(this._hiddenPlaylist);
  },
  
  onLoad: function() {
  
    var controller = this;
    
    this.setup();

    this._paneIsLoaded = true;
    
    this._strings = document.getElementById("smarty-pants-strings");
    
    this._goButton = document.getElementById("go-button");
    this._saveButton = document.getElementById("save-button");
    this._clearButton = document.getElementById("clear-button");
    this._helpButton = document.getElementById("help-button");
    this._trackTree = document.getElementById("track-tree");
    this._outputTree = document.getElementById("output-tree");
    this._ignoreDuplicateMatchesCheckbox = document.getElementById("ignore-duplicate-matches-checkbox");
    this._showAdvancedOptionsCheckbox = document.getElementById("show-advanced-options-checkbox");
    this._advancedOptionsGroup = document.getElementById("advanced-options-group");
    this._detailsGroup = document.getElementById("details-group");
    this._recommendationTree = document.getElementById("recommendation-tree");
    this._ignoreScoresTextbox = document.getElementById("ignore-scores-below-textbox");
    this._similarTrackWeightTextbox = document.getElementById("similar-track-weight-textbox");
    this._recommendationFilterList = document.getElementById("recommendation-filter-list");
    this._recommendationFilterAll = document.getElementById("recommendation-filter-all");
    this._recommendationFilterStreamable = document.getElementById("recommendation-filter-steamable");
    this._recommendationFilterFull = document.getElementById("recommendation-filter-full");
    this._playlistLimitToSongsTextbox = document.getElementById("playlist-limit-to-songs-textbox");
    this._playlistLimitToTimeTextbox = document.getElementById("playlist-limit-to-time-textbox");
    this._tryOtherArtistCheckbox = document.getElementById("try-other-artist-checkbox");
    this._fuzzyMatchCheckbox = document.getElementById("fuzzy-match-checkbox");
    this._doSimilarTracksCheckbox = document.getElementById("do-similar-tracks-check");
    this._doSimilarArtistsCheckbox = document.getElementById("do-similar-artists-check");
    this._doTopTracksCheckbox = document.getElementById("do-artist-top-tracks-check");
    this._doTracksFromArtistCheckbox = document.getElementById("do-tracks-from-artist-check");
    this._diminishTrackScoresCheckbox = document.getElementById("diminish-track-scores-check");
    this._diminishTracksAfterTextbox = document.getElementById("diminish-tracks-after-textbox");
    this._defaultSimilarArtistTrackScoreTextbox = document.getElementById("default-similar-artist-track-score-textbox");
    this._artistTopTrackWeightTextbox = document.getElementById("artist-top-track-weight-textbox");
    this._similarArtistTrackWeightTextbox = document.getElementById("similar-artist-track-weight-textbox");
    this._similarArtistSimilarityWeightTextbox = document.getElementById("similar-artist-similarity-weight-textbox");
    this._maxTopTracksTextbox = document.getElementById("max-top-tracks-textbox");
    this._maxNumToProcessTextbox = document.getElementById("max-num-to-process-textbox");
    this._ignoreNotInLibraryCheckbox = document.getElementById("ignore-not-in-library-checkbox");
    this._ignoreSimilarTracksFromSameArtistCheckbox = document.getElementById("ignore-similar-tracks-from-same-artist-check");
    this._doArtistTopAlbumsCheckbox = document.getElementById("do-artist-top-albums-check");
    this._showArtistImagesCheck = document.getElementById("show-artist-images-check");
    this._showAlbumImagesCheck = document.getElementById("show-album-images-check");
    this._preferencesList = document.getElementById("preferences-list");
    this._automaticModeCheck = document.getElementById("automatic-mode-checkbox");
    this._dontShowAllAlbumsCheck = document.getElementById("dont-show-all-albums-check");
    this._trackRatingWeightTextbox = document.getElementById("track-rating-weight-textbox");
    this._similarArtistWeightTextbox = document.getElementById("similar-artist-weight-textbox");
    this._exportRecommendedButton = document.getElementById("export-recommended-button");
    this._exportArtistButton = document.getElementById("export-artist-button");
    this._boostOtherArtistsCheckbox = document.getElementById("boost-other-artist-scores-check");
    this._penaliseSameArtistsCheckbox = document.getElementById("penalise-same-artist-scores-check");
    
    this._goButton.setAttribute("label", this._strings.getString("goButtonGo"));
    
    this._goButton.addEventListener("command", 
          function() { controller.startOrStopProcessing(); }, false);
    this._helpButton.addEventListener("command", 
          function() { controller.openHelp(); }, false);
    this._clearButton.addEventListener("command", 
          function() { controller.clearAllTracks(); }, false);
    this._saveButton.addEventListener("command", 
          function() { controller.savePlaylist(); }, false);
    this._showAdvancedOptionsCheckbox.addEventListener("command", 
          function() { controller.onShowAdvancedOptionsCheck(); }, false);
    this._recommendationFilterList.addEventListener("command", 
          function() { controller.onRecommendationFilterCommand(); }, false);
    this._ignoreScoresTextbox.addEventListener("change", 
          function() { controller.onIgnoreScoresChange(); }, false);
    this._similarArtistTrackWeightTextbox.addEventListener("change", 
          function() { controller.onSimilarArtistTrackWeightChange(true); }, false);
    this._similarArtistSimilarityWeightTextbox.addEventListener("change", 
          function() { controller.onSimilarArtistSimilarityWeightChange(false); }, false);
    this._showArtistImagesCheck.addEventListener("command", 
          function() { controller.onShowArtistImagesCheck(); }, false);
    this._showAlbumImagesCheck.addEventListener("command", 
          function() { controller.onShowAlbumImagesCheck(); }, false);
    this._automaticModeCheck.addEventListener("command", 
          function() { controller.onToggleAutomaticMode(); }, false);
    this._preferencesList.addEventListener("command", 
          function() { controller.onChangePreferences(); }, false);
    this._exportRecommendedButton.addEventListener("command", 
          function() { controller.onExportRecommended(); }, false);
    this._exportArtistButton.addEventListener("command", 
          function() { controller.onExportArtist(); }, false);
    
    this._showArtistImages = this._showArtistImagesCheck.getAttribute("checked") == "true";
    this._showAlbumImages = this._showAlbumImagesCheck.getAttribute("checked") == "true";
    
    this._outputTreeView = {  
        dataArray: [],
        rowCount: 0,
        getCellText : function(row,column) {  
          return this.dataArray[row];  
        },  
        setTree: function(treebox) { this.treebox = treebox; },  
        isContainer: function(row) { return false; },  
        isSeparator: function(row) { return false; },  
        isSorted: function() { return false; },  
        getLevel: function(row) { return 0; },  
        getImageSrc: function(row,col) { return null; },  
        getRowProperties: function(row,props) {},  
        getCellProperties: function(row,col,props) {},  
        getColumnProperties: function(colid,col,props) {}, 
        update: function(candidateTracks) {
          this.rowCount = this.dataArray.length; 
        } 
    };
    
    this._mediaCoreManager.addListener(this);
  },
  
  onUnLoad: function() {
  },
  
  getIgnoreScoresBelow: function() {
    if (this._ignoreScoresTextbox) {
      return this._ignoreScoresTextbox.value;
    }
    
    return 0.25;
  },
  
  onShowAdvancedOptionsCheck: function() {
    if (this._showAdvancedOptionsCheckbox.getAttribute("checked") == "true") {
      this._advancedOptionsGroup.setAttribute("hidden", "false");
    }
    else {
      this._advancedOptionsGroup.setAttribute("hidden", "true");
    }
  },
  
  onTrackTreeDoubleClick: function(event) {
    var clickedIndex = this._trackTree.treeBoxObject.getRowAt(event.clientX, event.clientY);
    this.playTrackAtIndex(clickedIndex);
  },
  
  playSelectedPlaylistSong: function() {
    this.playTrackAtIndex(this._trackTree.currentIndex);
  },
  
  playTrackAtIndex: function(index) {
    if (index >= 0 && index < this._hiddenPlaylist.length)
    {
      this._mediaCoreManager.sequencer.playView(this._hiddenPlaylistView, index);
      
      if (this._automaticMode) {
        this._playingAutoModePlaylist = true;
      }
    }
  },
  
  openSelectedPlaylistSong: function() {
    this.openPlaylistSongInLastFm(this._trackTree.currentIndex);
  },
  
  openSelectedPlaylistArtist: function() {
    var currentIndex = this._trackTree.currentIndex;
    
    if (currentIndex >= 0 && currentIndex < this._trackTreeView.dataArray.length)
    {
      var clickedItem = this._trackTreeView.dataArray[currentIndex];
      this.openArtistInLastFm(clickedItem.artistName);
    }
  },
  
  playSelectedPlaylistArtistRadio: function() {
    var currentIndex = this._trackTree.currentIndex;
    
    if (currentIndex >= 0 && currentIndex < this._trackTreeView.dataArray.length)
    {
      var clickedItem = this._trackTreeView.dataArray[currentIndex];
      this.playArtistRadio(clickedItem.artistName);
    }
  },
  
  openSelectedRecommendedSong: function() {
    this.openRecommendedSongInLastFm(this._recommendationTree.currentIndex);
  },
  
  openSelectedRecommendedArtist: function() {
    var currentIndex = this._recommendationTree.currentIndex;
    
    if (currentIndex >= 0 && currentIndex < this._recommendationTreeView.dataArray.length)
    {
      var clickedItem = this._recommendationTreeView.dataArray[currentIndex];
      this.openArtistInLastFm(clickedItem.artistName);
    }
  },
  
  playSelectedRecommendedArtistRadio: function() {
    var currentIndex = this._recommendationTree.currentIndex;
    
    if (currentIndex >= 0 && currentIndex < this._recommendationTreeView.dataArray.length)
    {
      var clickedItem = this._recommendationTreeView.dataArray[currentIndex];
      this.playArtistRadio(clickedItem.artistName);
    }
  },
  
  onRecommendationFilterCommand: function() {
    if (this._recommendationFilterList.selectedItem == this._recommendationFilterAll) {
      this._recommendationFilterSelection = 0;
    }
    else if (this._recommendationFilterList.selectedItem == this._recommendationFilterStreamable) {
      this._recommendationFilterSelection = 1;
    }
    else if (this._recommendationFilterList.selectedItem == this._recommendationFilterFull) {
      this._recommendationFilterSelection = 2;
    }
    else {
      this._recommendationFilterSelection = 0;
    }
    
    this._recommendationTreeView.update(this._candidateTracks);
    this._recommendationTree.view = this._recommendationTreeView;
  },
  
  onChangePreferences: function() {
    if (this._preferencesList.selectedItem == document.getElementById("preferences-list-default")) {
      this.setDefaultPreferences();
    }
    else if (this._preferencesList.selectedItem == document.getElementById("preferences-list-best-results")) {
      this.setBestResultsPreferences();
    }
    else if (this._preferencesList.selectedItem == document.getElementById("preferences-list-quick")) {
      this.setQuickPreferences();
    }
    else if (this._preferencesList.selectedItem == document.getElementById("preferences-list-super-quick")) {
      this.setSuperQuickPreferences();
    }
    else if (this._preferencesList.selectedItem == document.getElementById("preferences-list-multiple-selection")) {
      this.setMultipleSelectionPreferences();
    }
    else if (this._preferencesList.selectedItem == document.getElementById("preferences-list-varied-results")) {
      this.setVariedResultsPreferences();
    }
    else if (this._preferencesList.selectedItem == document.getElementById("preferences-list-artist-top-tracks")) {
      this.setArtistTopTracksPreferences();
    }
    else if (this._preferencesList.selectedItem == document.getElementById("preferences-list-artist-and-similar-top-tracks")) { 
      this.setArtistAndSimilarTopTracksPreferences();
    }
    else if (this._preferencesList.selectedItem == document.getElementById("preferences-list-artist-album-recommendations")) {
      this.setArtistAndAlbumRecommendationsPreferences();
    }
    else if (this._preferencesList.selectedItem == document.getElementById("preferences-list-all-from-artist-and-similar")) {
      this.setAllFromArtistAndSimilarPreferences();
    }
    else if (this._preferencesList.selectedItem == document.getElementById("preferences-list-auto-mode")) {
      this.setAutoModePreferences();
    }
    
  },  
  
  onRecommendationTreeDoubleClick: function(event) {
    var clickedIndex = this._recommendationTree.treeBoxObject.getRowAt(event.clientX, event.clientY);
    this.openRecommendedSongInLastFm(clickedIndex);
  },
    
  openRecommendedSongInLastFm: function(index) {
    if (index >= 0 && index < this._recommendationTreeView.dataArray.length)
    {
      var item = this._recommendationTreeView.dataArray[index];
      this.openSongInLastFm(item);
    }
  },
  
  openPlaylistSongInLastFm: function(index) {
    if (index >= 0 && index < this._trackTreeView.dataArray.length)
    {
      var item = this._trackTreeView.dataArray[index];
      this.openSongInLastFm(item);
    }
  },
      
  openSongInLastFm: function(item) {
    var url = item.url;
    if (url == null) {
      url = "http://www.last.fm/music/" + encodeURIComponent(item.artistName) + "/_/" + encodeURIComponent(item.trackName);
    }
    
    if (url != null && item.streamable > 0) {
      url += "?autostart";
    }
      
    if (url != null) {
      this._gBrowser.loadURI(url, null, null, null, '_blank');
    }
  },
  
  openArtistInLastFm: function(artistName) {
    url = "http://www.last.fm/music/" + encodeURIComponent(artistName);
    this._gBrowser.loadURI(url, null, null, null, '_blank');
  },
  
  playArtistRadio: function(artistName) {    
    
    try {
      var lastFmRadioSvc = Cc['@songbirdnest.com/lastfm;1'].getService().wrappedJSObject;
      lastFmRadioSvc.radioPlay("lastfm://artist/" + encodeURIComponent(artistName) + "/similarartists"); 
    }
    catch (e) {
      var radioUrl = "http://www.last.fm/listen/artist/" + encodeURIComponent(artistName);
      this._gBrowser.loadURI(radioUrl);
    }
  },
  
  onIgnoreScoresChange: function(event) {
    this.updateAllTrees();
  },
          
  onSimilarArtistTrackWeightChange: function(event) {
    var similarArtistTrackWeight = parseFloat(this._similarArtistTrackWeightTextbox.value);
    this._similarArtistSimilarityWeightTextbox.value = (1-similarArtistTrackWeight);
  },
  
  onSimilarArtistSimilarityWeightChange: function(event) {
    var similarArtistSimilarityWeight = parseFloat(this._similarArtistSimilarityWeightTextbox.value);
    this._similarArtistTrackWeightTextbox.value = (1-similarArtistSimilarityWeight);
  },
  
  onShowArtistImagesCheck: function(event) {
    this._showArtistImages = this._showArtistImagesCheck.getAttribute("checked") == "true";
    this.updateArtistList();
  },
  
  onShowAlbumImagesCheck: function(event) {
    this._showAlbumImages = this._showAlbumImagesCheck.getAttribute("checked") == "true";
    this.updateArtistList();
  },
  
  onToggleAutomaticMode: function(event) {
    this._automaticMode = !this._automaticMode;
  
    if (this._automaticMode) {
      this.enableButtons(false, true);
      
      this.setAutoModePreferences();
      this._preferencesList.selectedItem = document.getElementById("preferences-list-auto-mode");
      
      var nowPlayingMediaItem = this._mediaCoreManager.sequencer.currentItem;
      if (nowPlayingMediaItem) {
        this._automaticModeHistory[nowPlayingMediaItem.guid] = true;      
        this.clearThenProcessTrack(nowPlayingMediaItem);
      }
    }
    else {
      this._automaticModeHistory = {};
      this.enableButtons(true, true);
    }
  },
  
  addSelectedTracks: function() {
    var songbirdWindow = this._windowMediator.getMostRecentWindow("Songbird:Main");   
    var mediaListView = songbirdWindow.gBrowser.currentMediaListView;

    if (mediaListView == null) {
      return false;
    }

    var selection = mediaListView.selection;
    var itemEnum = selection.selectedMediaItems;

    if (!itemEnum.hasMoreElements()) {
      return false;
    }

    while (itemEnum.hasMoreElements()) {
      var item = itemEnum.getNext();
      this._candidateTracks.addOrUpdate(this.makeCandidateTrackFromMediaItem(item, null, 1), false);
      this._candidateArtists.addOrUpdate(this.makeSeedArtistFromMediaItem(item));
    }
    
    this.updateTrackTrees(true);
    this.updateArtistList();
    return true;
  },
  
  makeCandidateTrackFromMediaItem: function(mediaItem, parentTrack, score) {
    var candidiateTrack = {
      trackName: mediaItem.getProperty(SBProperties.trackName),
      artist: mediaItem.getProperty(SBProperties.artistName),
      album: mediaItem.getProperty(SBProperties.albumName),
      relatedTo: [],
      processed: false,
      guid: mediaItem.guid,
      seedTrack: parentTrack == null,
      isGettingScored: false,
      needsRescoring: true,
      maxSimilarityScore: 0,
      url: null,
      streamable: 0,
      similarArtistTopTrackScore: 0,
      similarArtist: null,
    }
    
    if (parentTrack != null) {
      candidiateTrack.relatedTo.push({track: parentTrack, score: score});
    }
    
    return candidiateTrack;
  },
  
  makeCandidateTrackFromSimilarArtistTopTrackMediaItem: function(mediaItem, similarArtist, score) {
    var candidiateTrack = {
      trackName: mediaItem.getProperty(SBProperties.trackName),
      artist: mediaItem.getProperty(SBProperties.artistName),
      album: mediaItem.getProperty(SBProperties.albumName),
      relatedTo: [],
      processed: false,
      guid: mediaItem.guid,
      seedTrack: false,
      isGettingScored: false,
      needsRescoring: true,
      maxSimilarityScore: 0,
      url: null,
      streamable: 0,
      similarArtistTopTrackScore: score,
      similarArtist: similarArtist,
    }
    
    return candidiateTrack;
  },
  
  makeCandidateTrackFromSimilarArtistTopTrackDetails: function(trackName, artistName, similarArtist, score, url, streamable) {
    var candidiateTrack = {
      trackName: trackName,
      artist: artistName,
      album: "",
      relatedTo: [],
      processed: false,
      guid: null,
      seedTrack: false,
      isGettingScored: false,
      needsRescoring: true,
      maxSimilarityScore: 0,
      url: url,
      streamable: streamable,
      similarArtistTopTrackScore: score,
      similarArtist: similarArtist,
    }
    
    return candidiateTrack;
  },
  
  makeCandidateTrackFromDetails: function(trackName, artistName, parentTrack, score, url, streamable) {
    var candidiateTrack = {
      trackName: trackName,
      artist: artistName,
      album: "",
      relatedTo: [],
      processed: false,
      guid: null,
      seedTrack: false,
      isGettingScored: false,
      needsRescoring: true,
      maxSimilarityScore: 0,
      url: url,
      streamable: streamable,
      similarArtistTopTrackScore: 0,
      similarArtist: null,
    };

    if (parentTrack != null) {
      candidiateTrack.relatedTo.push({track: parentTrack, score: score});
    }

    return candidiateTrack;
  },
  
  makeSeedArtistFromMediaItem: function(mediaItem) {
    var candidiateArtist = {
      artistName: mediaItem.getProperty(SBProperties.artistName),
      seedArtist: true,
      similarityScore: 1,
      accumulatedSimilarTrackScore: 0,
      processed: false,
      url: null,
      imageUrl: null,
      albums: [],
    }
        
    return candidiateArtist;
  },
  
  makeCandidateArtistFromDetails: function(artistName, score) {
    var candidiateArtist = {
      artistName: artistName,
      seedArtist: false,
      similarityScore: 0,
      accumulatedSimilarTrackScore: score,
      processed: false,
      url: null,
      imageUrl: null,
      albums: [],
    };
        
    return candidiateArtist;
  },
  
  makeCandidateArtistFromSimilarArtistDetails: function(parentArtist, artistName, score, url, imageUrl) {
    var candidiateArtist = {
      artistName: artistName,
      seedArtist: false,
      similarityScore: parentArtist.similarityScore*score,
      accumulatedSimilarTrackScore: 0,
      processed: false,
      url: url,
      imageUrl: imageUrl,
      albums: [],
    };
        
    return candidiateArtist;
  },
  
  makeCandidateArtistFromMediaItem: function(mediaItem, score) {
    var candidiateArtist = {
      artistName: mediaItem.getProperty(SBProperties.artistName),
      seedArtist: false,
      similarityScore: 0,
      accumulatedSimilarTrackScore: score,
      processed: false,
      url: null,
      imageUrl: null,
      albums: [],
    };
        
    return candidiateArtist;
  },
  
  clearAllTracks: function() {
    this.stopProcessing(true);
    
    if (this._goButton) {
      this._goButton.setAttribute("disabled", false);
    }
  
    this._fixedQueryArtists = {};
    this._fixedResultArtists = {};
    this._fixedResultSongs = {};
  
    this._candidateTracks.clear();
    this._candidateArtists.clear();
    this.updateAllTrees();
    this.clearOutputText();
    
    if (this._goButton) {
      this._goButton.setAttribute("label", this._strings.getString("goButtonGo"));
      this._goButton.setAttribute("enabled", true);
    }
    
    this._numProcessed = 0;
  },
  
  addOutputText: function(text) {
    if (this._outputTreeView) {
      this._outputTreeView.dataArray.push(text);
      this._outputTreeView.update();
      this._outputTree.view = this._outputTreeView;
      
      var boxobject = this._outputTree.boxObject;
      boxobject.ensureRowIsVisible(this._outputTreeView.dataArray.length - 1);
    }
  },
  
  clearOutputText: function() {
    if (this._outputTreeView) {
      this._outputTreeView.dataArray = [];
      this._outputTreeView.update();
      this._outputTree.view = this._outputTreeView;
    }
  },
  
  updateAllTrees: function() {
    this.updateTrackTrees();
    this.updateArtistList();
  },
  
  updateTrackTrees: function(reset) {
    this._candidateTracks.sortByScore();
    this._trackTreeView.update(this._candidateTracks, reset);
    if (this._trackTree) {
      this._trackTree.view = this._trackTreeView;
    }
    
    this._recommendationTreeView.update(this._candidateTracks);
    if (this._recommendationTree) {
      this._recommendationTree.view = this._recommendationTreeView;
    }
  },
  
  openHelp: function() {
    var helpUrl = "http://code.google.com/p/smarty-pants/wiki/BasicHelp";
    this._gBrowser.loadURI(helpUrl, null, null, null, '_blank');
  },
  
  startOrStopProcessing: function() {
    if (this._processing) {
      this.stopProcessing(false);
    }
    else {
      var startProcessing = true;
      if (this._candidateTracks.dataArray.length == 0) {
        startProcessing = this.addSelectedTracks();
      }
      
      if (startProcessing) {
        this.startProcessing();
      }
    }
  },
  
  stopProcessing: function(finished) {
    this._processing = false;
    
    if (this._goButton && finished) {
      this._goButton.setAttribute("label", this._strings.getString("goButtonGo"));
      this._goButton.setAttribute("disabled", true);
    }
    else if (this._goButton) {
      this._goButton.setAttribute("label", this._strings.getString("goButtonResume"));
    }
  },
  
  startProcessing: function() {
    this._processing = true;
    
    if (this._goButton) {
      this._goButton.setAttribute("label", this._strings.getString("goButtonStop"));
      this._ignoreDuplicateMatches = (this._ignoreDuplicateMatchesCheckbox.getAttribute("checked") == "true" ? true : false);
      this._tryOtherArtist = (this._tryOtherArtistCheckbox.getAttribute("checked") == "true" ? true : false);
      this._fuzzyMatch = (this._fuzzyMatchCheckbox.getAttribute("checked") == "true" ? true : false);
      this._similarTrackWeight = parseFloat(this._similarTrackWeightTextbox.value);
      this._doSimilarTracks = (this._doSimilarTracksCheckbox.getAttribute("checked") == "true" ? true : false);
      this._doSimilarArtists = (this._doSimilarArtistsCheckbox.getAttribute("checked") == "true" ? true : false);
      this._doTopTracks = (this._doTopTracksCheckbox.getAttribute("checked") == "true" ? true : false);
      this._doTracksFromArtist = (this._doTracksFromArtistCheckbox.getAttribute("checked") == "true" ? true : false);
      this._diminishTrackScores = (this._diminishTrackScoresCheckbox.getAttribute("checked") == "true" ? true : false);
      this._diminishTracksAfter = parseInt(this._diminishTracksAfterTextbox.value);
      this._defaultSimilarArtistTrackScore = parseFloat(this._defaultSimilarArtistTrackScoreTextbox.value);
      this._artistTopTrackWeight = parseFloat(this._artistTopTrackWeightTextbox.value);
      this._similarArtistTrackWeight = parseFloat(this._similarArtistTrackWeightTextbox.value);
      this._similarArtistSimilarityWeight = parseFloat(this._similarArtistSimilarityWeightTextbox.value);
      this._maxTopTracks = parseInt(this._maxTopTracksTextbox.value);
      this._maxNumToProcess = parseInt(this._maxNumToProcessTextbox.value);
      this._ignoreNotInLibrary = (this._ignoreNotInLibraryCheckbox.getAttribute("checked") == "true" ? true : false);
      this._ignoreSimilarTracksFromSameArtist = (this._ignoreSimilarTracksFromSameArtistCheckbox.getAttribute("checked") == "true" ? true : false);
      this._doArtistTopAlbums = (this._doArtistTopAlbumsCheckbox.getAttribute("checked") == "true" ? true : false);
      this._dontShowAllAlbums = (this._dontShowAllAlbumsCheck.getAttribute("checked") == "true" ? true : false);
      this._trackRatingWeight = parseFloat(this._trackRatingWeightTextbox.value);
      this._similarArtistWeight = parseFloat(this._similarArtistWeightTextbox.value);
      this._boostOtherArtists = (this._boostOtherArtistsCheckbox.getAttribute("checked") == "true" ? true : false);
      this._penaliseSameArtists = (this._penaliseSameArtistsCheckbox.getAttribute("checked") == "true" ? true : false);
    }
    else {
      this._ignoreDuplicateMatches = true;
      this._tryOtherArtist = false;
      this._fuzzyMatch = true;
      this._similarTrackWeight = 1.0;
      this._doSimilarTracks = true;
      this._doSimilarArtists = true;
      this._doTopTracks = true;
      this._doTracksFromArtist = false;
      this._diminishTrackScores = true;
      this._diminishTracksAfter = 2;
      this._defaultSimilarArtistTrackScore = 0.15;
      this._artistTopTrackWeight = 0.7;
      this._similarArtistTrackWeight = 0.25;
      this._similarArtistSimilarityWeight = 0.75;
      this._maxTopTracks = 5;
      this._maxNumToProcess = 15;
      this._ignoreNotInLibrary = true;
      this._ignoreSimilarTracksFromSameArtist = true;
      this._doArtistTopAlbums = false;
      this._dontShowAllAlbums = true;
      this._trackRatingWeight = 0.25;
      this._similarArtistWeight = 0.75;
    }
    
    setTimeout("SmartyPants.PaneController.doProcessNextTrackOrArtist()", 0);
  },
  
  enableButtons: function(enable, doGoButton) {
    var disabled = enable ? "false" : "true";
    this._clearButton.setAttribute("disabled", disabled);
    
    if (doGoButton) {
      this._goButton.setAttribute("disabled", disabled);
    }
    else {
      this._saveButton.setAttribute("disabled", disabled);
    }
  },
  
  doProcessNextTrackOrArtist: function() {
    
    if (this._processing) {
    
      if (this._numProcessed >= this._maxNumToProcess) {
        // All tracks and artists are processed, stop processing
        this.addOutputText(this._strings.getString("maxSongsProcessedOutputText"));
        this.stopProcessing(true);
      }
      else {
        var minScore = this._ignoreScoresTextbox ? parseFloat(this._ignoreScoresTextbox.value) : 0.15;
      
        var bestTrackScore = 0;
        for (var index = 0; index < this._candidateTracks.dataArray.length; index++) {
          var curTrack = this._candidateTracks.dataArray[index];
          if (!curTrack.processed) {
            bestTrackScore = curTrack.diminishedScore;
            var bestTrack = curTrack;
            break;
          }
        }
        
        var bestArtistScore = 0;
        for (var index = 0; index < this._candidateArtists.dataArray.length; index++) {
          var curArtist = this._candidateArtists.dataArray[index];
          var artistScore = this._candidateArtists.getScore(curArtist);
          if (!curArtist.processed) {
            bestArtistScore = artistScore;
            var bestArtist = curArtist;
            break;
          }
        }
        
        if (bestTrack != null && bestTrackScore >= minScore && bestTrackScore >= bestArtistScore) {
          this._processingTrackOrArtist = bestTrack;
          
          if (this.processTrack(bestTrack)) {
            setTimeout("SmartyPants.PaneController.doProcessNextTrackOrArtist()", 0);
          }
          return;
        }
        else if (bestArtist != null && bestArtistScore >= minScore) {
          this._processingTrackOrArtist = bestArtist;
          
          if (this.processArtist(bestArtist)) {
            setTimeout("SmartyPants.PaneController.doProcessNextTrackOrArtist()", 0);
          }
          
          return;
        }
        
        // All tracks and artists are processed, stop processing
        this.addOutputText(this._strings.getString("allSongsProcessedOutputText"));
        this.stopProcessing(true);
      }
    }
    
  },
  
  // return the original artist name on error so no further processing is done
  findArtistInLastFm: function(artistName) {
    var requestUri = LAST_FM_ROOT_URL + "?method=" + ARTIST_SEARCH_METHOD + 
                        "&artist=" + encodeURIComponent(artistName) +
                        "&limit=1" +
                        "&api_key=" + LAST_FM_API_KEY;

    var request = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Ci.nsIXMLHttpRequest);

    this.addOutputText(this._strings.getFormattedString("findingArtistOutputText", [artistName]));
    
    request.open("GET", requestUri, false);
    try {
    	request.send(null);
    }
    catch (e) {
      return artistName;
    }

    if (!this._processing || !request.responseXML || request.status != REQUEST_SUCCESS_CODE) {
      return artistName;
    }
    
    var xml = request.responseXML;
    
    var mainElement = xml.getElementsByTagName('results');
    if (mainElement == null || mainElement.length < 1) {
      return artistName;
    }
    
    var matches = mainElement[0].getElementsByTagName('artistmatches');
    if (matches.length < 1) {
      return artistName;
    }
    
    var match = matches[0].getElementsByTagName('artist');
    if (match.length < 1) {
      return artistName;
    }
    
    var artist = match[0].getElementsByTagName('name');
    if (artist.length < 1) {
      return artistName;
    }
    
    return artist[0].textContent;
  },
  
  // Return true to keep going afterwards, false to get out of the processing loop
  processTrack: function(track) {
    if (!this._doSimilarTracks) {
      track.processed = true;
      return true;
    }
    
    if (this._ignoreNotInLibrary && track.guid == null) {
      track.processed = true;
      return true;
    }
    
    var artistToUse = null;
    // Have we queried this artist before?
    if (this._fixedQueryArtists[track.artist] != null) {
      artistToUse = this._fixedQueryArtists[track.artist];
    }
    else if (this._tryOtherArtist) {
      // Find the closest matching artist
      artistToUse = this.findArtistInLastFm(track.artist);
      
      if (this._processingTrackOrArtist != track) {
        return false;
      }
    }
    
    if (artistToUse == null || artistToUse.length == 0) {
      artistToUse = track.artist;
    }
    
    this._fixedQueryArtists[track.artist] = artistToUse;
      
    this.addOutputText(this._strings.getFormattedString("processingTrackOutputText", [artistToUse, track.trackName]));
    
    if (!this.processTrackWithDetails(track, track.trackName, artistToUse)) {
      return false;
    }
    
    track.processed = true;
    this._numProcessed++;
    return true;
  },
  
  processTrackWithDetails: function(track, trackName, artistName) {
    var requestUri = LAST_FM_ROOT_URL + "?method=" + TRACK_GETSIMILAR_METHOD + 
                        "&track=" + encodeURIComponent(trackName) +
                        "&artist=" + encodeURIComponent(artistName) +
                        "&api_key=" + LAST_FM_API_KEY;

    var request = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Ci.nsIXMLHttpRequest);

    request.open("GET", requestUri, false);
    try {
    	request.send(null);
    }
    catch (e) {
      // If processing has been stopped
      if (!this._processing) {
        return false;
      }

      this.addOutputText(this._strings.getString("lastfmResponseErrorOutputText"));
      track.processed = true;
      return true;
    }

    if (!this._processing || this._processingTrackOrArtist != track) {
      return false;
    }

    if (!request.responseXML || request.status != REQUEST_SUCCESS_CODE) {
      this.addOutputText(this._strings.getString("lastfmResponseErrorOutputText"));
      track.processed = true;
      return true; 
    }
    
    if (this.parseSimilarTrackXml(track, request.responseXML, artistName)) {
      track.processed = true;
    }
    
    return true;
  },
  
  parseSimilarTrackXml: function(track, xml, sourceArtistName) {
    
    var mainElement = xml.getElementsByTagName('similartracks');
    if (mainElement == null || mainElement.length < 1) {
      this.addOutputText(this._strings.getFormattedString("noSimilarTracksOutputText", [track.artist, track.trackName]));
      return false;
    }
    
    var tracks = mainElement[0].getElementsByTagName('track');
    if (tracks.length < 1) {
      this.addOutputText(this._strings.getFormattedString("noSimilarTracksOutputText", [track.artist, track.trackName]));
      return false;
    }
    
    var foundTracks = 0;
    var totalTracks = tracks.length;
    var bestNonArtistScore = 0;
    
    var mytemp = true;
    
    for (var index = 0; index < totalTracks; index++) {
      
      var trackNode = tracks[index];
      var artistName = this.getArtistFromTrackNode(trackNode);
      
      var artistsAreEqual = 
          artistName.length == sourceArtistName.length 
          && 
          artistName.toLowerCase().indexOf(sourceArtistName.toLowerCase()) != -1;
         
      if (this._ignoreSimilarTracksFromSameArtist && artistsAreEqual) {
        continue;
      }
      
      var trackName = this.getTrackFromTrackNode(trackNode);
      var score = this.getScoreFromTrackNode(trackNode);
      var url = this.getUrlFromTrackNode(trackNode);
      var streamable = this.getStreamableFromTrackNode(trackNode);
       
      if (!artistsAreEqual && bestNonArtistScore == 0) {
        bestNonArtistScore = score;
      }
      
      if (score > track.maxSimilarityScore) {
        track.maxSimilarityScore = score;
      }
      
      // Give the highest scoring non-artist track a score of 0.95
      if (this._boostOtherArtists && !artistsAreEqual) {
        
        if (mytemp) {
          //alert("for " + trackName + " was " + score + " now " + (score * (0.95/bestNonArtistScore)));
          
        }
        
        score *= (0.95/bestNonArtistScore);
      }
      
      // Give results from the same artist a penalty
      if (this._penaliseSameArtists && artistsAreEqual) {
        score /= 1.5;
      }
            
      var bestSong = VandelayIndustriesSharedForSmartyPants.Functions.findBestSongInLibrary(artistName, trackName);

      if (bestSong != null) {
        var candidateTrack = this.makeCandidateTrackFromMediaItem(bestSong, track, score);
        this._candidateTracks.addOrUpdate(candidateTrack, false);
        this._candidateArtists.addOrUpdate(this.makeCandidateArtistFromMediaItem(bestSong, score));
        foundTracks++;
      }
      else {      
        if (this._fuzzyMatch) {
          // Have we already fixed the artist or track?
          var bestSong = null;
          if (this._fixedResultArtists[artistName] != null) {
            bestSong = VandelayIndustriesSharedForSmartyPants.Functions.findBestSongInLibrary(this._fixedResultArtists[artistName], trackName);
          }
          else if (this._fixedResultSongs[trackName] != null) {
            bestSong = VandelayIndustriesSharedForSmartyPants.Functions.findBestSongInLibrary(artistName, this._fixedResultSongs[trackName]);
          }
          
          if (bestSong != null) {
            var candidateTrack = this.makeCandidateTrackFromMediaItem(bestSong, track, score);
            this._candidateTracks.addOrUpdate(candidateTrack, false);
            this._candidateArtists.addOrUpdate(this.makeCandidateArtistFromMediaItem(bestSong, score));
            foundTracks++;
          }
          else {
            
            // Try to find a good match
            var songsFromArtist = VandelayIndustriesSharedForSmartyPants.Functions.findArtistInLibrary(artistName);
            var bestSongFromArtistScore = -100;
            var bestSongFromArtist = null;
            if (songsFromArtist != null && songsFromArtist.length > 0) {
              
              var enumerator = songsFromArtist.enumerate();
              while (enumerator.hasMoreElements()) {
                var curSongFromArtist = enumerator.getNext();
                
                var curTrackName = curSongFromArtist.getProperty(SBProperties.trackName);
                var curDiffScore = VandelayIndustriesSharedForSmartyPants.Functions.getDifferenceScore(trackName, curTrackName);
                
                if 
                (
                  curDiffScore > bestSongFromArtistScore
                  || 
                  (
                    curDiffScore == bestSongFromArtistScore
                    &&
                    curSongFromArtist.getProperty(SBProperties.bitRate) > bestSongFromArtist.getProperty(SBProperties.bitRate)
                  )
                ) {
                  bestSongFromArtist = curSongFromArtist;
                  bestSongFromArtistScore = curDiffScore;
                }
              }
            }
            
            var artistsFromSong = VandelayIndustriesSharedForSmartyPants.Functions.findTrackInLibrary(trackName);
            var bestArtistFromSongScore = -100;
            var bestArtistFromSong = null;
            if (artistsFromSong != null && artistsFromSong.length > 0) {
              for (var artistIndex = 0; artistIndex < artistsFromSong.length; artistIndex++) {
              
                var enumerator = artistsFromSong.enumerate();
                while (enumerator.hasMoreElements()) {
                  var curArtistFromSong = enumerator.getNext();
                  
                  var curArtistName = curArtistFromSong.getProperty(SBProperties.artistName);
                  var curDiffScore = VandelayIndustriesSharedForSmartyPants.Functions.getDifferenceScore(artistName, curArtistName);
                  
                  if 
                  (
                    curDiffScore > bestArtistFromSongScore
                    ||
                    (
                      curDiffScore == bestArtistFromSongScore
                      &&
                      curArtistFromSong.getProperty(SBProperties.bitRate) > bestArtistFromSong.getProperty(SBProperties.bitRate)
                    )
                  ) {
                    bestArtistFromSong = curArtistFromSong;
                    bestArtistFromSongScore = curDiffScore;
                  }
                }
              }
            }
            
            // If we have a good track match for the artist, use it
            // Don't use it if we have already found that track in this list of similar tracks
            if 
            (
              bestSongFromArtistScore > 0 
              ||
              (bestSongFromArtistScore >= -3 && bestSongFromArtistScore*-1 < trackName.length/2 && bestSongFromArtistScore*-1 < bestSongFromArtist.getProperty(SBProperties.trackName).length/2)
            ) {
              this.addOutputText(this._strings.getFormattedString("correctedSongOutputText", [artistName, trackName, bestSongFromArtist.getProperty(SBProperties.trackName)]));
              this._fixedResultSongs[trackName] = bestSongFromArtist.getProperty(SBProperties.trackName);
              var candidateTrack = this.makeCandidateTrackFromMediaItem(bestSongFromArtist, track, score);
              this._candidateTracks.addOrUpdate(candidateTrack, false);
              this._candidateArtists.addOrUpdate(this.makeCandidateArtistFromMediaItem(bestSongFromArtist, score));
              foundTracks++;
            }
            // Otherwise if we have a good artist match for the track, use that
            // Don't use it if we have already found that track in this list of similar tracks
            else if
            (
              bestArtistFromSongScore > 0 
              ||
              (bestArtistFromSongScore >= -3 && bestArtistFromSongScore*-1 < artistName.length/2 && bestArtistFromSongScore*-1 < bestArtistFromSong.getProperty(SBProperties.artistName).length/2)
            ) {
              this.addOutputText(this._strings.getFormattedString("correctedSongOutputText", [artistName, trackName, bestArtistFromSong.getProperty(SBProperties.artistName)]));
              this._fixedResultArtists[artistName] = bestArtistFromSong.getProperty(SBProperties.artistName);
              var candidateTrack = this.makeCandidateTrackFromMediaItem(bestArtistFromSong, track, score);
              this._candidateTracks.addOrUpdate(candidateTrack, false);
              this._candidateArtists.addOrUpdate(this.makeCandidateArtistFromMediaItem(bestArtistFromSong, score));
              foundTracks++;
            }
            // Otherwise, use it as a recommendation
            else {
              var candidateTrack = this.makeCandidateTrackFromDetails(trackName, artistName, track, score, url, streamable);
              this._candidateTracks.addOrUpdate(candidateTrack, false);
              this._candidateArtists.addOrUpdate(this.makeCandidateArtistFromDetails(artistName, score));
            }
          }
        }
        // No fuzzy matching
        else {
          var candidateTrack = this.makeCandidateTrackFromDetails(trackName, artistName, track, score, url, streamable);
          this._candidateTracks.addOrUpdate(candidateTrack, false);
          this._candidateArtists.addOrUpdate(this.makeCandidateArtistFromDetails(artistName, score));
        }
      }
      
      
      if (mytemp && !artistsAreEqual) {
        //alert("for " + trackName + " score is " + score);
        mytemp = false;
      }
    }
    
    this.addOutputText(this._strings.getFormattedString("foundSimilarTracksOutputText", [totalTracks, foundTracks]));
    this.updateTrackTrees();
    
    return true;
  },
  
  getArtistFromTrackNode: function(trackNode) {
    var artistElement = trackNode.getElementsByTagName('artist');
    if (artistElement != null && artistElement.length > 0) {
      var artistNameElement = artistElement[0].getElementsByTagName('name');
      if (artistNameElement != null && artistNameElement.length > 0) {
        return artistNameElement[0].textContent;
      }
    }
    
    return "";
  },
  
  getTrackFromTrackNode: function(trackNode) {
    var nameElement = trackNode.getElementsByTagName('name');
    if (nameElement != null && nameElement.length > 0) {
      return nameElement[0].textContent;
    }
    
    return "";
  },
  
  getScoreFromTrackNode: function(trackNode) {
    var matchElement = trackNode.getElementsByTagName('match');
    if (matchElement != null && matchElement.length > 0) {
      return parseFloat(matchElement[0].textContent);
    }
    
    return 0;
  },
  
  getUrlFromTrackNode: function(trackNode) {
    var urlElement = trackNode.getElementsByTagName('url');
    if (urlElement != null && urlElement.length > 0) {
      return urlElement[0].textContent;
    }
    
    return "";
  },
  
  // 0 for not streamable, 1 for streamable, 2 for fully streamable
  getStreamableFromTrackNode: function(trackNode) {
    var steamableElement = trackNode.getElementsByTagName('streamable');
    if (steamableElement != null && steamableElement.length > 0) {
      if (steamableElement[0].textContent == "1") {
        if (steamableElement[0].getAttribute("fulltrack") == "1") {
          return 2;
        }
        else {
          return 1;
        }
      }
    }
    
    return 0;
  },
  
  getPlaycountFromTrackNode: function(trackNode) {
    var playcountElement = trackNode.getElementsByTagName('playcount');
    if (playcountElement != null && playcountElement.length > 0) {
      return parseInt(playcountElement[0].textContent);
    }
    
    return 0;
  },
  
  getArtistFromArtistNode: function(artistNode) {
    var artistNameElement = artistNode.getElementsByTagName('name');
    if (artistNameElement != null && artistNameElement.length > 0) {
      return artistNameElement[0].textContent;
    }
    
    return "";
  },
  
  getScoreFromArtistNode: function(artistNode) {
    var matchElement = artistNode.getElementsByTagName('match');
    if (matchElement != null && matchElement.length > 0) {
      return parseFloat(matchElement[0].textContent);
    }
    
    return 0;
  },
  
  getUrlFromArtistNode: function(artistNode) {
    var urlElement = artistNode.getElementsByTagName('url');
    if (urlElement != null && urlElement.length > 0) {
      return urlElement[0].textContent;
    }
    
    return null;
  },
  
  getImageUrlFromArtistNode: function(artistNode) {
    var imageElement = artistNode.getElementsByTagName('image');
    if (imageElement != null && imageElement.length > 0) {
      for (var tagIndex = 0; tagIndex < imageElement.length; tagIndex++) {
        if (imageElement[tagIndex].getAttribute("size") == "medium") {
          return imageElement[tagIndex].textContent;
        }
      }
    }
    
    return null;
  },
  
  getAlbumFromAlbumNode: function(albumNode) {
    var nameElement = albumNode.getElementsByTagName('name');
    if (nameElement != null && nameElement.length > 0) {
      return nameElement[0].textContent;
    }
    
    return null;
  },
  
  getUrlFromAlbumNode: function(albumNode) {
    var urlElement = albumNode.getElementsByTagName('url');
    if (urlElement != null && urlElement.length > 0) {
      return urlElement[0].textContent;
    }
    
    return null;
  },
  
  getImageUrlFromAlbumNode: function(albumNode) {
    var imageElement = albumNode.getElementsByTagName('image');
    if (imageElement != null && imageElement.length > 0) {
      for (var tagIndex = 0; tagIndex < imageElement.length; tagIndex++) {
        if (imageElement[tagIndex].getAttribute("size") == "medium") {
          return imageElement[tagIndex].textContent;
        }
      }
    }
    
    return null;
  },
  
  savePlaylist: function() {
    if (this._trackTreeView.dataArray.length < 1) {
      return;
    }
    
    var seedTrack = this._trackTreeView.dataArray[0];
    var moreThanOneSeedTrack = (this._trackTreeView.dataArray.length > 1 && this._trackTreeView.dataArray[1].score == 1);
  
    var newPlaylist = LibraryUtils.mainLibrary.createMediaList("simple");    
    var newPlaylistName = this._strings.getString("playlistNameStart") + " " + seedTrack.artistName + " - " + seedTrack.trackName;
    if (moreThanOneSeedTrack) {
      newPlaylistName += " " + this._strings.getString("playlistNameEnd");
    }
      
    newPlaylist.name = newPlaylistName;
    
    var maxSongs = parseInt(this._playlistLimitToSongsTextbox.value);
    var maxMinutes = parseInt(this._playlistLimitToTimeTextbox.value);
    var maxSeconds = maxMinutes*60;
    
    var numSongs = 0;
    var numSeconds = 0;
    for (var index=0; index < this._trackTreeView.dataArray.length; index++) {
    
      if (maxSongs > 0 && numSongs >= maxSongs) {
        break;
      }
      
      if (maxMinutes > 0 && numSeconds >= maxSeconds) {
        break;
      }
    
      var curItem = this._trackTreeView.dataArray[index];
      
      if (curItem.guid != null) {
        var mediaItem = LibraryUtils.mainLibrary.getItemByGuid(curItem.guid);
        if (mediaItem != null) {
          newPlaylist.add(mediaItem);
          
          numSongs++;
          var curSeconds = (mediaItem.getProperty(SBProperties.duration)/1000000);
          numSeconds += curSeconds;
        }
      }
    }
  },
  
  onMediacoreEvent: function(event) {
    switch (event.type) {
      case Ci.sbIMediacoreEvent.BEFORE_TRACK_CHANGE :
        if (this._automaticMode && !this._ignoreTrackChanges) {
          this._automaticModeHistory[event.data.guid] = true;
          this.clearThenProcessTrack(event.data);
          
          if (this._playingAutoModePlaylist) {
            this._ignoreTrackChanges = true;
            this._mediaCoreManager.sequencer.playView(this._hiddenPlaylistView, 0);
            this._ignoreTrackChanges = false;
          }
        }
        else if (!this._automaticMode) {
          this.playingAutoModePlaylist = false;
        }
        break;
        
      case Ci.sbIMediacoreEvent.TRACK_CHANGE :
        if (this._trackTreeView.treebox != null) {
          this._trackTreeView.treebox.invalidate();        
        }
        break;
    }
  },
  
  clearThenProcessTrack: function(mediaItem) {    
    if (mediaItem == null) {
      return;
    }
    
    this.stopProcessing(true);
    this.clearAllTracks();
    
    this._candidateTracks.addOrUpdate(this.makeCandidateTrackFromMediaItem(mediaItem, null, 1), true);
    this._candidateArtists.addOrUpdate(this.makeSeedArtistFromMediaItem(mediaItem));
    this.updateTrackTrees(true);
    this.updateArtistList();    
    
    this.startProcessing();
  },
  
  // return true to keep processing afterwards, false to get out of processing loop
  processArtist: function(artist) {
    if (!this._doSimilarArtists && !this._doTracksFromArtist && !this._doTopTracks && !this._doArtistTopAlbums) {
      artist.processed = true;
      return true;
    }
    
    if (this._ignoreNotInLibrary) {
      var artistInLibrary = false;
      var songsFromArtist = VandelayIndustriesSharedForSmartyPants.Functions.findArtistInLibrary(artist.artistName);
      if (songsFromArtist == null || songsFromArtist.length == 0) {
        if (this._fixedResultArtists[artist.artistName] != null) {
          songsFromArtist = VandelayIndustriesSharedForSmartyPants.Functions.findArtistInLibrary(this._fixedResultArtists[artist.artistName]);
        }
      }
      
      if (songsFromArtist != null && songsFromArtist.length > 0) {
        artistInLibrary = true;
      }
      
      if (!artistInLibrary) {
        artist.processed = true;
        return true;
      }
    }
    
    var artistName = artist.artistName;
    if (this._fixedQueryArtists[artistName] != null) {
      artistName = this._fixedQueryArtists[artistName];
    }
  
    this.addOutputText(this._strings.getFormattedString("processingArtistOutputText", [artistName]));
    
    if (this._doSimilarArtists) {    
      if (!this.findSimilarArtists(artist, artistName) || !this._processing) {
        return false;
      }
    }
    
    if (this._doTracksFromArtist) {
      this.addTracksFromSimilarArtist(artist);
    }
    
    if (this._doTopTracks) {
      if (!this.findTopTracks(artist, artistName) || !this._processing) {
        return false;
      }
    }
    
    if (this._doArtistTopAlbums) {
      if (!this.findTopAlbums(artist, artistName) || !this._processing) {
        return false;
      }
    }
    
    artist.processed = true;
    this._numProcessed++;
    return true;
  },
  
  findSimilarArtists: function(artist, artistName) {
  
    var requestUri = LAST_FM_ROOT_URL + "?method=" + ARTIST_GETSIMILAR_METHOD + 
                        "&artist=" + encodeURIComponent(artistName) +
                        "&api_key=" + LAST_FM_API_KEY;

    var request = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Ci.nsIXMLHttpRequest);

    request.open("GET", requestUri, false);
    try {
    	request.send(null);
    }
    catch (e) {
      // If processing has been stopped
      if (!this._processing) {
        return false;
      }

      this.addOutputText(this._strings.getString("lastfmResponseErrorOutputText"));
      return true;
    }

    if (!this._processing || this._processingTrackOrArtist != artist) {
      return false;
    }

    if (!request.responseXML || request.status != REQUEST_SUCCESS_CODE) {
      this.addOutputText(this._strings.getString("lastfmResponseErrorOutputText"));
      return true; 
    }
    
    this.processSimilarArtistXml(artist, request.responseXML);
    return true; 
  },
  
  processSimilarArtistXml: function(artist, xml) {
  
    var mainElement = xml.getElementsByTagName('similarartists');
    if (mainElement == null || mainElement.length < 1) {
      this.addOutputText(this._strings.getFormattedString("noSimilarArtistsOutputText", [artist.artistName]));
      return;
    }
    
    var artists = mainElement[0].getElementsByTagName('artist');
    if (artists.length < 1) {
      this.addOutputText(this._strings.getFormattedString("noSimilarArtistsOutputText", [artist.artistName]));
      return;
    }
    
    var totalArtists = artists.length;
    this.addOutputText(this._strings.getFormattedString("foundSimilarArtistsOutputText", [totalArtists]));
    
    
    for (var index = 0; index < totalArtists; index++) {
      
      var artistNode = artists[index];
      var artistName = this.getArtistFromArtistNode(artistNode);
      var score = this.getScoreFromArtistNode(artistNode);
      var url = this.getUrlFromArtistNode(artistNode);
      var imageUrl = this.getImageUrlFromArtistNode(artistNode);
      
      var scaledScore = score / 101;
      
      scaledScore *= this._similarArtistWeight;
      
      this._candidateArtists.addOrUpdate(this.makeCandidateArtistFromSimilarArtistDetails(artist, artistName, scaledScore, url, imageUrl))
    }
    
    this.updateArtistList();
  },
  
  addTracksFromSimilarArtist: function(artist) {
  
    var defaultSimilarArtistScore = this._defaultSimilarArtistTrackScore;
  
    var songsFromArtist = VandelayIndustriesSharedForSmartyPants.Functions.findArtistInLibrary(artist.artistName);
    
    // If we can't find any songs from the artist, try with a corrected artist
    if (songsFromArtist == null || songsFromArtist.length == 0) {
      if (this._fixedResultArtists[artist.artistName] != null) {
        songsFromArtist = VandelayIndustriesSharedForSmartyPants.Functions.findArtistInLibrary(this._fixedResultArtists[artist.artistName]);
      }
    }
     
    // If we found some, add them all with a low score
    var tracksAdded = 0;
    if (songsFromArtist != null && songsFromArtist.length > 0) {
      var enumerator = songsFromArtist.enumerate();
      
      while (enumerator.hasMoreElements()) {
        var curSongFromArtist = enumerator.getNext();
        this._candidateTracks.addOrUpdate(this.makeCandidateTrackFromSimilarArtistTopTrackMediaItem(curSongFromArtist, artist, defaultSimilarArtistScore), false);
        tracksAdded++;
      }
    }
    
    if (tracksAdded == 0) {
      this.addOutputText(this._strings.getString("noTracksFromSimilarArtistOutputText"));
    }
    else {
      this.addOutputText(this._strings.getFormattedString("tracksFromSimilarArtistOutputText", [tracksAdded]));
      this.updateTrackTrees();
    }
  },
  
  findTopTracks: function(artist, artistName) {
    
    var requestUri = LAST_FM_ROOT_URL + "?method=" + ARTIST_GETTOPTRACKS_METHOD + 
                        "&artist=" + encodeURIComponent(artistName) +
                        "&api_key=" + LAST_FM_API_KEY;

    var request = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Ci.nsIXMLHttpRequest);

    request.open("GET", requestUri, false);
    try {
    	request.send(null);
    }
    catch (e) {
      // If processing has been stopped
      if (!this._processing) {
        return false;
      }

      this.addOutputText(this._strings.getString("lastfmResponseErrorOutputText"));
      return true;
    }

    if (!this._processing || this._processingTrackOrArtist != artist) {
      return false;
    }

    if (!request.responseXML || request.status != REQUEST_SUCCESS_CODE) {
      this.addOutputText(this._strings.getString("lastfmResponseErrorOutputText"));
      return true; 
    }
    
    this.processTopTracksXml(artist, artistName, request.responseXML);
    return true;
  },
  
  processTopTracksXml: function(artist, artistName, xml) {
  
    var mainElement = xml.getElementsByTagName('toptracks');
    if (mainElement == null || mainElement.length < 1) {
      this.addOutputText(this._strings.getFormattedString("noTopTracksOutputText", [artist.artistName]));
      return;
    }
    
    var tracks = mainElement[0].getElementsByTagName('track');
    if (tracks.length < 1) {
      this.addOutputText(this._strings.getFormattedString("noTopTracksOutputText", [artist.artistName]));
      return;
    }
    
    var maxTracks = this._maxTopTracks;
    var totalTracks = tracks.length;
    var foundTracks = 0;
    var addedTracks = 0;
    
    var processedTracks = {};
    
    // scale top tracks linearly, diminishing returns can be used to adjust this later
    for (var index = 0; index < totalTracks && addedTracks < maxTracks; index++) {
      
      var trackNode = tracks[index];
      var trackName = this.getTrackFromTrackNode(trackNode);
      var url = this.getUrlFromTrackNode(trackNode);
      var streamable = this.getStreamableFromTrackNode(trackNode);
      
      var topTrackWeight = this._artistTopTrackWeight;
      var scoreFromTopTrack = (1-((addedTracks+1)/(totalTracks+1))) * topTrackWeight;
      
      // Try to find using the library artist name
      var guids = VandelayIndustriesSharedForSmartyPants.Functions.findSongInLibrary(artist.artistName, trackName);
      if (guids == null || guids.length == 0) {
        // If that doesn't work try using the last.fm artist name
        guids = VandelayIndustriesSharedForSmartyPants.Functions.findSongInLibrary(artistName, trackName);
      }
      
      if (guids != null && guids.length > 0) {
        var mediaItem = LibraryUtils.mainLibrary.getItemByGuid(guids[0]);
        if (mediaItem != null) {
          var candidateTrack = this.makeCandidateTrackFromSimilarArtistTopTrackMediaItem(mediaItem, artist, scoreFromTopTrack);
          this._candidateTracks.addOrUpdate(candidateTrack, false);
          foundTracks++;
          addedTracks++;
          
          processedTracks[candidateTrack.trackName] = true;
        }
      }
      else {
        // try fuzzy matching
        var bestSongFromArtistScore = -100;
        var bestSongFromArtist = null;
        
        //try to fuzzy match the library artist name
        var songsFromArtist = VandelayIndustriesSharedForSmartyPants.Functions.findArtistInLibrary(artist.artistName);
        if (songsFromArtist != null && songsFromArtist.length > 0) {
          var enumerator = songsFromArtist.enumerate();
          while (enumerator.hasMoreElements()) {
            var curSongFromArtist = enumerator.getNext();
            
            var curTrackName = curSongFromArtist.getProperty(SBProperties.trackName);
            var curDiffScore = VandelayIndustriesSharedForSmartyPants.Functions.getDifferenceScore(trackName, curTrackName);
            
            if (curDiffScore > bestSongFromArtistScore) {
              bestSongFromArtist = curSongFromArtist;
              bestSongFromArtistScore = curDiffScore;
            }
          }
        }
        //try to fuzzy match the last.fm artist name
        songsFromArtist = VandelayIndustriesSharedForSmartyPants.Functions.findArtistInLibrary(artistName);
        if (songsFromArtist != null && songsFromArtist.length > 0) {
          var enumerator = songsFromArtist.enumerate();
          while (enumerator.hasMoreElements()) {
            var curSongFromArtist = enumerator.getNext();
            
            var curTrackName = curSongFromArtist.getProperty(SBProperties.trackName);
            var curDiffScore = VandelayIndustriesSharedForSmartyPants.Functions.getDifferenceScore(trackName, curTrackName);
            
            if (curDiffScore > bestSongFromArtistScore) {
              bestSongFromArtist = curSongFromArtist;
              bestSongFromArtistScore = curDiffScore;
            }
          }
        }
        
        // If we found a good fuzzy match, use it
        // Don't use it if we've already found the song that we would correct it to
        if 
        (
          (
            bestSongFromArtistScore > 0 
            ||
            (bestSongFromArtistScore >= -3 && bestSongFromArtistScore*-1 < trackName.length/2 && bestSongFromArtistScore*-1 < bestSongFromArtist.getProperty(SBProperties.trackName).length/2)
          )
          &&
          processedTracks[bestSongFromArtist.getProperty(SBProperties.trackName)] == null
        ) {
          var candidateTrack = this.makeCandidateTrackFromSimilarArtistTopTrackMediaItem(bestSongFromArtist, artist, scoreFromTopTrack);
          this._candidateTracks.addOrUpdate(candidateTrack, false);
          this.addOutputText(this._strings.getFormattedString("correctedSongOutputText", [artistName, trackName, bestSongFromArtist.getProperty(SBProperties.trackName)]));
          this._fixedResultSongs[trackName] = bestSongFromArtist.getProperty(SBProperties.trackName);
          foundTracks++;
          addedTracks++;
          
          processedTracks[candidateTrack.trackName] = true;
        }
        // Otherwise add the song as a recommendation
        else if (!this._ignoreNotInLibrary)
        {
          this._candidateTracks.addOrUpdate(this.makeCandidateTrackFromSimilarArtistTopTrackDetails(trackName, artistName, artist, scoreFromTopTrack, url, streamable), false);
          addedTracks++;
        }  
      }
    }
    
    this.addOutputText(this._strings.getFormattedString("foundTopTracksOutputText", [addedTracks, foundTracks]));
    this.updateTrackTrees();
  },
  
  findTopAlbums: function(artist, artistName) {    
    var requestUri = LAST_FM_ROOT_URL + "?method=" + ARTIST_GETTOPALBUMS_METHOD + 
                        "&artist=" + encodeURIComponent(artistName) +
                        "&api_key=" + LAST_FM_API_KEY;

    var request = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Ci.nsIXMLHttpRequest);

    request.open("GET", requestUri, false);
    try {
    	request.send(null);
    }
    catch (e) {
      // If processing has been stopped
      if (!this._processing) {
        return false;
      }

      this.addOutputText(this._strings.getString("lastfmResponseErrorOutputText"));
      return true;
    }

    if (!this._processing || this._processingTrackOrArtist != artist) {
      return false;
    }

    if (!request.responseXML || request.status != REQUEST_SUCCESS_CODE) {
      this.addOutputText(this._strings.getString("lastfmResponseErrorOutputText"));
      return true; 
    }
    
    this.processTopAlbumsXml(artist, artistName, request.responseXML);    
    return true; 
  },
  
  processTopAlbumsXml: function(artist, artistName, xml) {
    var mainElement = xml.getElementsByTagName('topalbums');
    if (mainElement == null || mainElement.length < 1) {
      this.addOutputText(this._strings.getFormattedString("noTopAlbumsOutputText", [artist.artistName]));
      return;
    }
    
    var albums = mainElement[0].getElementsByTagName('album');
    if (albums.length < 1) {
      this.addOutputText(this._strings.getFormattedString("noTopAlbumsOutputText", [artist.artistName]));
      return;
    }
    
    var totalAlbums = albums.length;
    
    for (var index = 0; index < totalAlbums; index++) {
    
      var albumNode = albums[index];
      var albumName = this.getAlbumFromAlbumNode(albumNode);
      var url = this.getUrlFromAlbumNode(albumNode);
      var imageUrl = this.getImageUrlFromAlbumNode(albumNode);
      
      // scale top albums linearly
      var score = (totalAlbums - index) / totalAlbums;
      
      // try to find album in library
      var songProps = Cc["@songbirdnest.com/Songbird/Properties/MutablePropertyArray;1"]
     	                  .createInstance(Ci.sbIMutablePropertyArray);
      songProps.appendProperty(SBProperties.artistName, artist.artistName);  
      songProps.appendProperty(SBProperties.albumName, albumName);
      var albumFound = false;
      
      try {
        var albumEnum = LibraryUtils.mainLibrary.getItemsByProperties(songProps);
        albumFound = albumEnum.length > 0;
      }
      catch (e) {
      }
        
      if (!albumFound) {
        var albumDictionary = {};
        
        try {
          var artistEnum = LibraryUtils.mainLibrary.getItemsByProperty(SBProperties.artistName, artist.artistName).enumerate();
          
          while (artistEnum.hasMoreElements()) {          
          	var item = artistEnum.getNext();
            var curAlbumName = item.getProperty(SBProperties.albumName);
            
            if (albumDictionary[curAlbumName] == null) {
              albumDictionary[curAlbumName] = true;
              
              var albumDiffScore = VandelayIndustriesSharedForSmartyPants.Functions.getDifferenceScore(albumName, curAlbumName);
              
              if 
              (
                albumDiffScore > 0
                ||
                (albumDiffScore >= -3 && albumDiffScore*-1 < albumName.length/2 && albumDiffScore*-1 < curAlbumName.length/2)
              ) {
                albumFound = true;
                break;
              }
            }
      		}
        }
        catch (e) {
        }
      }
      
      if (!this._dontShowAllAlbums || !albumFound) {        
        // Only add as a recommendation if it isn't already in the library
        artist.albums.push({albumName: albumName, url: url, imageUrl: imageUrl});
      }
    }
  
    this.addOutputText(this._strings.getFormattedString("foundTopAlbumsOutputText", [totalAlbums]));
    this.updateArtistList();
  },
  
  /*
  findUrlForArtist: function(artist) {
    var requestUri = LAST_FM_ROOT_URL + "?method=" + ARTIST_SEARCH_METHOD + 
                        "&artist=" + encodeURIComponent(artist.artistName) +
                        "&limit=1" +
                        "&api_key=" + LAST_FM_API_KEY;

    var request = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Ci.nsIXMLHttpRequest);

    request.open("GET", requestUri, false);
    try {
    	request.send(null);
    }
    catch (e) {
      return;
    }
    
    var xml = request.responseXML;
    
    var mainElement = xml.getElementsByTagName('results');
    if (mainElement == null || mainElement.length < 1) {
      return;
    }
    
    var matches = mainElement[0].getElementsByTagName('artistmatches');
    if (matches.length < 1) {
      return;
    }
    
    var match = matches[0].getElementsByTagName('artist');
    if (match.length < 1) {
      return;
    }
    
    var urlElement = match[0].getElementsByTagName('url');
    if (urlElement.length > 0) {
      artist.url = urlElement[0].textContent;
    }
  },
  */
  
  addArtistInfo: function(artist, score, index) {
    var listBox = document.getElementById('artist-list');
    
    if (!listBox) {
      return;
    }
    
    var listitem = document.createElement("richlistitem");
    var artistInfo = document.createElement("artistinfo");
    artistInfo.setAttribute("class", "artistinfo");
    artistInfo.setAttribute("artistName", artist.artistName);
    
    if (artist.imageUrl) {
      artistInfo.setAttribute("artistImage", artist.imageUrl);
    }
    else {
      artistInfo.setAttribute("artistImage", "chrome://smarty-pants/skin/default-artist-image.png");
    }
    
    this.addAlbumsToArtist(artist, 4, artistInfo);
    
    artistInfo.setAttribute("hideArtistImage", !this._showArtistImages);
    
    // not displayed
    artistInfo.setAttribute("index", index);
    artistInfo.setAttribute("albumNameId", "album-name-" + index);

    listitem.appendChild(artistInfo);

    listBox.appendChild(listitem);
  },
  
  addAlbumsToArtist: function(artist, numAlbums, artistInfo) {
    for (var index=0; index < numAlbums; index++) {
      this.addAlbumToArtist(artist, index, artistInfo);
    }
  },
  
  addAlbumToArtist: function(artist, index, artistInfo) {
    if (artist.albums.length > index) {
      if (artist.albums[index].imageUrl != null) {
        artistInfo.setAttribute("album" + (index+1) + "Image", artist.albums[index].imageUrl);
      }
      else {
        artistInfo.setAttribute("album" + (index+1) + "Image", "chrome://smarty-pants/skin/default-album-image.gif");        
      }
      artistInfo.setAttribute("album" + (index+1) + "Name", artist.albums[index].albumName);
    }
    else {
      artistInfo.setAttribute("hideAlbum" + (index+1) + "Image", "true");
    }
    
    if (!this._showAlbumImages) {
      artistInfo.setAttribute("hideAlbum" + (index+1) + "Image", "true");
    }
  },
  
  clearArtistInfo: function() {
    var listBox = document.getElementById('artist-list');
    while (listBox && listBox.lastChild) {
      listBox.removeChild(listBox.lastChild);
    }
  },
  
  updateArtistList: function() {
    this._candidateArtists.sortByScore();
    this.clearArtistInfo();
    
    var minScore = 0.05;
    for (var index = 0; index < this._candidateArtists.dataArray.length; index++) {
      var curArtist = this._candidateArtists.dataArray[index];
      var score = this._candidateArtists.getScore(curArtist);
      if (score >= minScore) {
        this.addArtistInfo(curArtist, score, index);
      }
    }
  },
  
  onArtistClick: function(node, event) {
    var artistIndex = parseInt(node.getAttribute("index"));
    var artist = this._candidateArtists.dataArray[artistIndex];
  
    var url = artist.url;
    if (url == null || url.length == 0) {
      url = "http://www.last.fm/music/" + encodeURIComponent(artist.artistName);
    }
    
    this._gBrowser.loadURI(url, null, null, event, '_blank');
    
    event.stopPropagation();
  },
  
  onPlayArtistRadioClick: function(node, event) {
    var artistIndex = parseInt(node.getAttribute("index"));
    var artist = this._candidateArtists.dataArray[artistIndex];
    this.playArtistRadio(artist.artistName);
    event.stopPropagation();
  },
  
  onAlbumClick: function(node, event, albumNumber) {
    var artistIndex = parseInt(node.getAttribute("index"));
    var artist = this._candidateArtists.dataArray[artistIndex];
    
    if (artist == null || albumNumber > artist.albums.length) {
      return;
    }
    
    var album = artist.albums[albumNumber-1];
  
    var url = album.url;
    if (url == null || url.length == 0) {
      url = "http://www.last.fm/music/" + encodeURIComponent(artist.artistName) + "/" + encodeURIComponent(album.albumName);
    }
    
    this._gBrowser.loadURI(url, null, null, event, '_blank');
    event.stopPropagation();
  },
  
  onExportRecommended: function() {
    var seedTrack = this._trackTreeView.dataArray[0];
    if (!seedTrack) {
      return;
    }

    var nsIFilePicker = Components.interfaces.nsIFilePicker;
    var fileChooser = Components.classes["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
    fileChooser.init(window, this._strings.getString("exportTitle"), nsIFilePicker.modeSave);
    fileChooser.appendFilters(nsIFilePicker.filterText | nsIFilePicker.filterAll); 

    var defaultFileName = this._strings.getString("exportRecommendedDefaultFile") + " " + seedTrack.artistName + " - " + seedTrack.trackName;

    fileChooser.defaultString = defaultFileName + ".txt";
    var fileBox = fileChooser.show();

    if (fileBox == nsIFilePicker.returnOK || fileBox == nsIFilePicker.returnReplace) {     
       var foStream = Components.classes["@mozilla.org/network/file-output-stream;1"].createInstance(Components.interfaces.nsIFileOutputStream);
       foStream.init(fileChooser.file, 0x02 | 0x08 | 0x20, 0666, 0);
       var converter = Components.classes["@mozilla.org/intl/converter-output-stream;1"].createInstance(Components.interfaces.nsIConverterOutputStream);
       converter.init(foStream, "UTF-8", 0, 0);

       for (var index = 0; index < this._recommendationTreeView.dataArray.length; index++) {
         var item = this._recommendationTreeView.dataArray[index];
         var dataString = item.artistName + " - " + item.trackName + "\n";
         converter.writeString(dataString);
       }

       converter.close();
    }
  },
  
  onExportArtist: function() {
    var seedTrack = this._trackTreeView.dataArray[0];
    if (!seedTrack) {
      return;
    }

    var nsIFilePicker = Components.interfaces.nsIFilePicker;
    var fileChooser = Components.classes["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
    fileChooser.init(window, this._strings.getString("exportTitle"), nsIFilePicker.modeSave);
    fileChooser.appendFilters(nsIFilePicker.filterText | nsIFilePicker.filterAll); 
    
    var defaultFileName = this._strings.getString("exportArtistDefaultFile") + " " + seedTrack.artistName;

    fileChooser.defaultString = defaultFileName + ".txt";
    var fileBox = fileChooser.show();

    if (fileBox == nsIFilePicker.returnOK || fileBox == nsIFilePicker.returnReplace) {     
      var foStream = Components.classes["@mozilla.org/network/file-output-stream;1"].createInstance(Components.interfaces.nsIFileOutputStream);
      foStream.init(fileChooser.file, 0x02 | 0x08 | 0x20, 0666, 0);
      var converter = Components.classes["@mozilla.org/intl/converter-output-stream;1"].createInstance(Components.interfaces.nsIConverterOutputStream);
      converter.init(foStream, "UTF-8", 0, 0);

      var artistList = document.getElementById('artist-list');

      if (!artistList) {
        return;
      }

      var artists = artistList.getElementsByTagName('artistinfo');
      for (var index = 0; index < artists.length; index++) {
        var dataString = artists[index].getAttribute('artistName');
        var album1Name = artists[index].getAttribute('album1Name');
        var album2Name = artists[index].getAttribute('album2Name');
        var album3Name = artists[index].getAttribute('album3Name');
        var album4Name = artists[index].getAttribute('album4Name');
        
        if (album1Name && album1Name.length > 0) {
          dataString += " - " + album1Name;
          if (album2Name && album2Name.length > 0) {
            dataString += ", " + album2Name;
            if (album3Name && album3Name.length > 0) {
              dataString += ", " + album3Name;
              if (album4Name && album4Name.length > 0) {
                dataString += ", " + album4Name;
              }
            }
          }
        }
        
        dataString += "\n";
        converter.writeString(dataString);
      }

      converter.close();
    }
  },
  
  setDefaultPreferences: function() {
    this._doSimilarTracksCheckbox.setAttribute("checked", "true");
    this._doSimilarArtistsCheckbox.setAttribute("checked", "true");
    this._doArtistTopAlbumsCheckbox.setAttribute("checked", "true");
    this._doTopTracksCheckbox.setAttribute("checked", "true");
    this._tryOtherArtistCheckbox.setAttribute("checked", "false");
    this._fuzzyMatchCheckbox.setAttribute("checked", "true");
    this._ignoreNotInLibraryCheckbox.setAttribute("checked", "false");
    this._ignoreScoresTextbox.value = 0.15;
    this._maxNumToProcessTextbox.value = 25;
    
    this._ignoreDuplicateMatchesCheckbox.setAttribute("checked", "true");
    this._ignoreSimilarTracksFromSameArtistCheckbox.setAttribute("checked", "false");
    this._diminishTrackScoresCheckbox.setAttribute("checked", "true");
    this._boostOtherArtistsCheckbox.setAttribute("checked", "true");
    this._penaliseSameArtistsCheckbox.setAttribute("checked", "true");
    this._diminishTracksAfterTextbox.value = 4;
    this._similarTrackWeightTextbox.value = 1.0;
    
    this._doTracksFromArtistCheckbox.setAttribute("checked", "false");
    this._defaultSimilarArtistTrackScoreTextbox.value = 0.15;
    this._artistTopTrackWeightTextbox.value = 0.5;
    this._similarArtistTrackWeightTextbox.value = 0.25;
    this._similarArtistSimilarityWeightTextbox.value = 0.75;
    this._maxTopTracksTextbox.value = 10;
    
    this._trackRatingWeightTextbox = 0.25;
    this._similarArtistWeightTextbox.value = 0.75;
  },
  
  setBestResultsPreferences: function() {
    this.setDefaultPreferences();
    
    this._doTopTracksCheckbox.setAttribute("checked", "false");
    this._ignoreScoresTextbox.value = 0.25;
    this._maxNumToProcessTextbox.value = 20;
  },
  
  setQuickPreferences: function() {
    this.setDefaultPreferences();
    
    this._doArtistTopAlbumsCheckbox.setAttribute("checked", "false");
    this._ignoreNotInLibraryCheckbox.setAttribute("checked", "true");
    this._maxNumToProcessTextbox.value = 10;
  },
  
  setSuperQuickPreferences: function() {
    this.setDefaultPreferences();
    
    this._doSimilarTracksCheckbox.setAttribute("checked", "false");
    this._doArtistTopAlbumsCheckbox.setAttribute("checked", "false");
    this._ignoreNotInLibraryCheckbox.setAttribute("checked", "true");
    this._maxNumToProcessTextbox.value = 10;
    this._diminishTracksAfterTextbox.value = 2;
    this._maxTopTracksTextbox.value = 5;
    this._artistTopTrackWeightTextbox.value = 1.0;
  },
  
  setMultipleSelectionPreferences: function() {
    this.setDefaultPreferences();
    
    this._doSimilarTracksCheckbox.setAttribute("checked", "true");
    this._doSimilarArtistsCheckbox.setAttribute("checked", "false");
    this._doArtistTopAlbumsCheckbox.setAttribute("checked", "false");
    this._doTopTracksCheckbox.setAttribute("checked", "false");
    this._ignoreDuplicateMatchesCheckbox.setAttribute("checked", "false");
    this._similarTrackWeightTextbox.value = 0.4;
    this._ignoreScoresTextbox.value = 0.05;
  },
  
  setVariedResultsPreferences: function() {
    this.setDefaultPreferences();
    
    this._ignoreSimilarTracksFromSameArtistCheckbox.setAttribute("checked", "true");
    this._ignoreScoresTextbox.value = 0.25;
    this._diminishTracksAfterTextbox.value = 1;
    this._maxTopTracksTextbox.value = 2;
    this._similarArtistTrackWeightTextbox.value = 0.5;
    this._similarArtistSimilarityWeightTextbox.value = 0.5;
  },
  
  setArtistTopTracksPreferences: function() {
    this.setDefaultPreferences();
    
    this._doSimilarTracksCheckbox.setAttribute("checked", "false");
    this._doSimilarArtistsCheckbox.setAttribute("checked", "false");
    this._maxNumToProcessTextbox.value = 1;
    this._ignoreScoresTextbox.value = 0.0;
    this._diminishTrackScoresCheckbox.setAttribute("checked", "false");
    this._artistTopTrackWeightTextbox.value = 1.0;
    this._maxTopTracksTextbox.value = 50;
    this._penaliseSameArtistsCheckbox.setAttribute("checked", "false");
  },
  
  setArtistAndSimilarTopTracksPreferences: function() {
    this.setDefaultPreferences();
    
    this._doSimilarTracksCheckbox.setAttribute("checked", "false");
    this._maxNumToProcessTextbox.value = 5;
    this._ignoreScoresTextbox.value = 0.0;
    this._diminishTrackScoresCheckbox.setAttribute("checked", "false");
    this._artistTopTrackWeightTextbox.value = 1.0;
    this._maxTopTracksTextbox.value = 50;
    this._similarArtistTrackWeightTextbox.value = 0.0;
    this._similarArtistSimilarityWeightTextbox.value = 1.0;
    this._similarArtistWeightTextbox.value = 1.0;
    this._penaliseSameArtistsCheckbox.setAttribute("checked", "false");
  },
  
  setArtistAndAlbumRecommendationsPreferences: function() {
    this.setDefaultPreferences();
    
    this._doSimilarTracksCheckbox.setAttribute("checked", "false");
    this._doTopTracksCheckbox.setAttribute("checked", "false");
    this._maxNumToProcessTextbox.value = 20;
    this._similarArtistTrackWeightTextbox.value = 0.0;
    this._similarArtistSimilarityWeightTextbox.value = 1.0;
    this._similarArtistWeightTextbox.value = 1.0;
  },
  
  setAllFromArtistAndSimilarPreferences: function() {
    this.setDefaultPreferences();
    
    this._doSimilarTracksCheckbox.setAttribute("checked", "false");
    this._maxNumToProcessTextbox.value = 5;
    this._similarArtistTrackWeightTextbox.value = 0.0;
    this._similarArtistSimilarityWeightTextbox.value = 1.0;
    this._doTracksFromArtistCheckbox.setAttribute("checked", "true");
    this._ignoreNotInLibraryCheckbox.setAttribute("checked", "true");
    this._ignoreScoresTextbox.value = 0.0;
    this._diminishTrackScoresCheckbox.setAttribute("checked", "false");
    this._artistTopTrackWeightTextbox.value = 1.0;
    this._maxTopTracksTextbox.value = 50;
    this._similarArtistWeightTextbox.value = 1.0;
    this._boostOtherArtistsCheckbox.setAttribute("checked", "false");
    this._penaliseSameArtistsCheckbox.setAttribute("checked", "false");
  },
  
  setAutoModePreferences: function() {
    this.setDefaultPreferences();
    this._maxNumToProcessTextbox.value = 10;
    this._ignoreScoresTextbox.value = 0.4;
  },  
  
};

window.addEventListener("load", function(e) { SmartyPants.PaneController.onLoad(e); }, false);
window.addEventListener("unload", function(e) { SmartyPants.PaneController.onUnLoad(e); }, false);

