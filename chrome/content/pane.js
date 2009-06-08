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

const LAST_FM_ROOT_URL = "http://ws.audioscrobbler.com/2.0/";
const LAST_FM_API_KEY = "72b14fe3e1fd7f8ff8a993b1f1e78a50";
const TRACK_GETSIMILAR_METHOD = "track.getSimilar";
const ARTIST_SEARCH_METHOD = "artist.search";
const ARTIST_GETSIMILAR_METHOD = "artist.getSimilar";
const ARTIST_GETTOPTRACKS_METHOD = "artist.getTopTracks";
const ARTIST_GETTOPALBUMS_METHOD = "artist.getTopAlbums";
const REQUEST_SUCCESS_CODE = 200;

if (typeof SmartyPants == 'undefined') {
  var SmartyPants = {};
}

const SMARTY_PANTS_HIDDEN_PLAYLIST_PROP = "smarty-pants_hidden-playlist";

/**
 * Controller for pane.xul
 */
SmartyPants.PaneController = {
  
  onLoad: function() {
  
    var controller = this;
    this._strings = document.getElementById("smarty-pants-strings");
    
    this._addButton = document.getElementById("add-button");
    this._goButton = document.getElementById("go-button");
    this._saveButton = document.getElementById("save-button");
    this._clearButton = document.getElementById("clear-button");
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
    this._albumTree = document.getElementById("recommended-albums-tree");
    this._maxTopAlbumsTextbox = document.getElementById("max-top-albums-textbox");
    this._showArtistImagesCheck = document.getElementById("show-artist-images-check");
    this._showArtistScoresCheck = document.getElementById("show-artist-scores-check");
    
    this._processing = false;
    this._goButton.setAttribute("label", this._strings.getString("goButtonGo"));
    
    this._addButton.addEventListener("command", 
          function() { controller.addSelectedTracks(); }, false);
    this._goButton.addEventListener("command", 
          function() { controller.startOrStopProcessing(); }, false);
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
    this._showArtistScoresCheck.addEventListener("command", 
          function() { controller.onShowArtistScoresCheck(); }, false);
          
    this._recommendationFilterSelection = 0;
    this._numProcessed = 0;
    
    this._showArtistScores = this._showArtistScoresCheck.getAttribute("checked") == "true";
    this._showArtistImages = this._showArtistImagesCheck.getAttribute("checked") == "true";
          
    this._candidateTracks = {
      dataArray: [],
      
      addOrUpdate: function(candidateTrack) {
      
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
      },
      
      scoreTrack: function(track) {
      
        if (!track.needsRescoring) {
          return track.score;
        }
        
        if (track.isGettingScored) {
          return -1; // Don't infinite loop
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
          
          if (!properScoreFound && similarArtistTopTrackScore == 0) {
            return -1;
          }
          
          if (similarTrackScore > 0.99999) {
            similarTrackScore = 0.99999;
          }
          
          track.needsRescoring = false;
          
          if (similarTrackScore > similarArtistTopTrackScore) {
            return similarTrackScore;
          }
          else {
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
    
    this._candidateAlbums = {
      dataArray: [],    
      
      add: function(candidateAlbum) {
        this.dataArray.push(candidateAlbum);
      },
      
      getScore: function(candidateAlbum) {
        var artistScore = controller._candidateArtists.getScore(candidateAlbum.artist);
        var albumScore = candidateAlbum.score;
        return artistScore * albumScore;
      },
            
      clear: function() {
        this.dataArray = [];
      },
      
      sortByScore: function() {
        this.dataArray.sort(this.sortByScoreFunc);
      },
      
      sortByScoreFunc: function(a, b) {
        return controller._candidateAlbums.getScore(a) < controller._candidateAlbums.getScore(b);
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
        getCellProperties: function(row,col,props) {},  
        getColumnProperties: function(colid,col,props) {}, 
        update: function(candidateTracks) { 
          this.dataArray = [];
          controller._hiddenPlaylist.clear();
          var minScore = parseFloat(controller._ignoreScoresTextbox.value);
          for (var index = 0; index < candidateTracks.dataArray.length; index++) {
            var curTrack = candidateTracks.dataArray[index];
            if (curTrack.guid != null) {
              var scoreToUse = curTrack.diminishedScore;
              if (scoreToUse >= minScore) {
                var curMediaItem = LibraryUtils.mainLibrary.getItemByGuid(curTrack.guid);
                if (curMediaItem != null) {
                  this.dataArray.push({trackName: curTrack.trackName, artistName: curTrack.artist, albumName: curTrack.album, score: scoreToUse, guid: curTrack.guid}); 
                  controller._hiddenPlaylist.add(curMediaItem);
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
              if (curMediaItem != null && controller._mediaCoreManager.sequencer.currentItem == curMediaItem) {
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
          var minScore = parseFloat(controller._ignoreScoresTextbox.value);
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
    
    this._recommendedAlbumTreeView = {  
        dataArray: [],
        rowCount: 0,
        getCellText : function(row,column) {  
          if (column.id == "album-list-artist-column") return this.dataArray[row].artistName;
          else if (column.id == "album-list-album-column") return this.dataArray[row].albumName;
          else if (column.id == "album-list-score-column") return this.dataArray[row].score;
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
        update: function(candidateAlbums) { 
          this.dataArray = [];
          var minScore = parseFloat(controller._ignoreScoresTextbox.value);
          for (var index = 0; index < candidateAlbums.dataArray.length; index++) {
            var curAlbum = candidateAlbums.dataArray[index];
            var score = candidateAlbums.getScore(curAlbum);
            if (score >= minScore) {
              this.dataArray.push(
                    {
                      artistName: curAlbum.artist.artistName, 
                      albumName: curAlbum.albumName, 
                      score: score
                    }); 
            }
          }
          this.rowCount = this.dataArray.length; 
        } 
    };
    
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
    
    this._fixedQueryArtists = {};
    this._fixedResultArtists = {};
    this._fixedResultSongs = {};
    
    this._windowMediator = Cc["@mozilla.org/appshell/window-mediator;1"]
                            .getService(Ci.nsIWindowMediator);
                            
    this._mediaCoreManager = Cc["@songbirdnest.com/Songbird/Mediacore/Manager;1"]  
                            .getService(Components.interfaces.sbIMediacoreManager);  
                            
    this._gBrowser = this._windowMediator.getMostRecentWindow("Songbird:Main").gBrowser;
    
    this._mediaCoreManager.addListener(this);
    
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
  
  onUnLoad: function() {
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
    
    if (clickedIndex >= 0 && clickedIndex < this._hiddenPlaylist.length)
    {
      this._mediaCoreManager.sequencer.playView(this._hiddenPlaylistView, clickedIndex);
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
  
  onRecommendationTreeDoubleClick: function(event) {
    var clickedIndex = this._recommendationTree.treeBoxObject.getRowAt(event.clientX, event.clientY);
    
    if (clickedIndex >= 0 && clickedIndex < this._recommendationTreeView.dataArray.length)
    {
      var clickedItem = this._recommendationTreeView.dataArray[clickedIndex];
      
      if (clickedItem.url != null) {
        var url = clickedItem.url;
        if (clickedItem.streamable > 0) {
          url += "?autostart";
        }
        this._gBrowser.loadURI(url, null, null, null, '_blank');
      }
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
  
  onShowArtistScoresCheck: function(event) {
    this._showArtistScores = this._showArtistScoresCheck.getAttribute("checked") == "true";
    this.updateArtistList();
  },
  
  addSelectedTracks: function() {
    var songbirdWindow = this._windowMediator.getMostRecentWindow("Songbird:Main");     
    var mediaListView = songbirdWindow.gBrowser.currentMediaListView;

    if (mediaListView == null) {
      return;
    }

    var selection = mediaListView.selection;
    var itemEnum = selection.selectedMediaItems;

    while (itemEnum.hasMoreElements()) {
      var item = itemEnum.getNext();
      this._candidateTracks.addOrUpdate(this.makeCandidateTrackFromMediaItem(item, null, 1));
      this._candidateArtists.addOrUpdate(this.makeSeedArtistFromMediaItem(item));
    }
    
    this.updateTrackTrees();
    this.updateArtistList();
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
      imageUrl: null
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
      imageUrl: null
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
      imageUrl: imageUrl
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
      imageUrl: null
    };
        
    return candidiateArtist;
  },
  
  makeCandidateAlbumFromDetails: function(artist, albumName, score) {
    var candidiateAlbum = {
      artist: artist,
      albumName: albumName,
      score: score
    };
        
    return candidiateAlbum;
  },
  
  clearAllTracks: function() {
    this._candidateTracks.clear();
    this._candidateArtists.clear();
    this._candidateAlbums.clear();
    this.updateAllTrees();
    this.clearOutputText();
    this._goButton.setAttribute("label", this._strings.getString("goButtonGo"));
    
    this._numProcessed = 0;
  },
  
  addOutputText: function(text) {
    this._outputTreeView.dataArray.push(text);
    this._outputTreeView.update();
    this._outputTree.view = this._outputTreeView;
    
    var boxobject = this._outputTree.boxObject;
    boxobject.ensureRowIsVisible(this._outputTreeView.dataArray.length - 1);
  },
  
  clearOutputText: function() {
    this._outputTreeView.dataArray = [];
    this._outputTreeView.update();
    this._outputTree.view = this._outputTreeView;
  },
  
  updateAllTrees: function() {
    this.updateTrackTrees();
    this.updateArtistList();
    this.updateAlbumTree();
  },
  
  updateTrackTrees: function() {
    this._candidateTracks.sortByScore();
    this._trackTreeView.update(this._candidateTracks);
    this._trackTree.view = this._trackTreeView;
    this._recommendationTreeView.update(this._candidateTracks);
    this._recommendationTree.view = this._recommendationTreeView;
  },
  
  updateAlbumTree: function() {
    this._candidateAlbums.sortByScore();
    this._recommendedAlbumTreeView.update(this._candidateAlbums);
    this._albumTree.view = this._recommendedAlbumTreeView;
  },
  
  startOrStopProcessing: function() {
    if (this._processing) {
      this.stopProcessing(false);
    }
    else {
      this.startProcessing();
    }
  },
  
  stopProcessing: function(finished) {
    this._processing = false;
    this.enableButtons(true);
    if (finished) {
      this._goButton.setAttribute("label", this._strings.getString("goButtonGo"));
    }
    else {
      this._goButton.setAttribute("label", this._strings.getString("goButtonResume"));
    }
  },
  
  startProcessing: function() {
    this._processing = true;
    this.enableButtons(false);
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
    this._maxTopAlbums = parseInt(this._maxTopAlbumsTextbox.value);
    
    setTimeout("SmartyPants.PaneController.doProcessNextTrackOrArtist()", 0);
  },
  
  enableButtons: function(enable) {
    var disabled = enable ? "false" : "true";
    this._addButton.setAttribute("disabled", disabled);
    this._saveButton.setAttribute("disabled", disabled);
    this._clearButton.setAttribute("disabled", disabled);
  },
  
  doProcessNextTrackOrArtist: function() {
    
    if (this._processing) {
    
      if (this._numProcessed >= this._maxNumToProcess) {
        // All tracks and artists are processed, stop processing
        this.addOutputText(this._strings.getString("maxSongsProcessedOutputText"));
        this.stopProcessing(true);
      }
      else {
        var minScore = parseFloat(this._ignoreScoresTextbox.value);
      
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
          this.processTrack(bestTrack);
      
          setTimeout("SmartyPants.PaneController.doProcessNextTrackOrArtist()", 0);
          return;
        }
        else if (bestArtist != null && bestArtistScore >= minScore) {
          this.processArtist(bestArtist);
      
          setTimeout("SmartyPants.PaneController.doProcessNextTrackOrArtist()", 0);
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
  
  processTrack: function(track) {
    if (!this._doSimilarTracks) {
      track.processed = true;
      return;
    }
    
    if (this._ignoreNotInLibrary && track.guid == null) {
      track.processed = true;
      return;
    }
    
    var artistToUse = null;
    // Have we queried this artist before?
    if (this._fixedQueryArtists[track.artist] != null) {
      artistToUse = this._fixedQueryArtists[track.artist];
    }
    else if (this._tryOtherArtist) {
      // Find the closest matching artist
      artistToUse = this.findArtistInLastFm(track.artist);
    }
    
    if (artistToUse == null || artistToUse.length == 0) {
      artistToUse = track.artist;
    }
    
    this._fixedQueryArtists[track.artist] = artistToUse;
      
    this.addOutputText(this._strings.getFormattedString("processingTrackOutputText", [artistToUse, track.trackName]));
    this.processTrackWithDetails(track, track.trackName, artistToUse)
    
    track.processed = true;
    this._numProcessed++;
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
        return true;
      }

      this.addOutputText(this._strings.getString("lastfmResponseErrorOutputText"));
      track.processed = true;
      return false;
    }

    if (!this._processing) {
      return true;
    }

    if (!request.responseXML || request.status != REQUEST_SUCCESS_CODE) {
      this.addOutputText(this._strings.getString("lastfmResponseErrorOutputText"));
      track.processed = true;
      return false; 
    }
    
    if (this.parseSimilarTrackXml(track, request.responseXML, artistName)) {
      track.processed = true;
      return true;
    }
    
    return false;
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
      
      if (score+1 > track.maxSimilarityScore) {
        track.maxSimilarityScore = score+1;
      }
            
      var guids = VandelayIndustriesSharedForSmartyPants.Functions.findSongInLibrary(artistName, trackName);

      if (guids != null && guids.length > 0) {
        var mediaItem = LibraryUtils.mainLibrary.getItemByGuid(guids[0]);
        var candidateTrack = this.makeCandidateTrackFromMediaItem(mediaItem, track, score);
        this._candidateTracks.addOrUpdate(candidateTrack);
        this._candidateArtists.addOrUpdate(this.makeCandidateArtistFromMediaItem(mediaItem, score));
        foundTracks++;
      }
      else {
      
        if (this._fuzzyMatch) {
          // Have we already fixed the artist or track?
          var songGuids = null;
          if (this._fixedResultArtists[artistName] != null) {
            var songGuids = VandelayIndustriesSharedForSmartyPants.Functions.findSongInLibrary(this._fixedResultArtists[artistName], trackName); 
          }
          else if (this._fixedResultSongs[trackName] != null) {
            var songGuids = VandelayIndustriesSharedForSmartyPants.Functions.findSongInLibrary(artistName, this._fixedResultSongs[trackName]);
          }
          
          if (songGuids != null && songGuids.length > 0) {
            var mediaItem = LibraryUtils.mainLibrary.getItemByGuid(songGuids[0]);
            var candidateTrack = this.makeCandidateTrackFromMediaItem(mediaItem, track, score);
            this._candidateTracks.addOrUpdate(candidateTrack);
            this._candidateArtists.addOrUpdate(this.makeCandidateArtistFromMediaItem(mediaItem, score));
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
                
                if (curDiffScore > bestSongFromArtistScore) {
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
                  
                  if (curDiffScore > bestArtistFromSongScore) {
                    bestArtistFromSong = curArtistFromSong;
                    bestArtistFromSongScore = curDiffScore;
                  }
                }
              }
            }
            
            // If we have a good track match for the artist, use it
            if 
            (
              bestSongFromArtistScore > 0 
              ||
              (bestSongFromArtistScore >= -3 && bestSongFromArtistScore*-1 < trackName.length/2)
            ) {
              this.addOutputText(this._strings.getFormattedString("correctedSongOutputText", [artistName, trackName, bestSongFromArtist.getProperty(SBProperties.trackName)]));
              this._fixedResultSongs[trackName] = bestSongFromArtist.getProperty(SBProperties.trackName);
              var candidateTrack = this.makeCandidateTrackFromMediaItem(bestSongFromArtist, track, score);
              this._candidateTracks.addOrUpdate(candidateTrack);
              this._candidateArtists.addOrUpdate(this.makeCandidateArtistFromMediaItem(bestSongFromArtist, score));
              foundTracks++;
            }
            // Otherwise if we have a good artist match for the track, use that
            else if
            (
              bestArtistFromSongScore > 0 
              ||
              (bestArtistFromSongScore >= -3 && bestArtistFromSongScore*-1 < artistName.length/2)
            ) {
              this.addOutputText(this._strings.getFormattedString("correctedSongOutputText", [artistName, trackName, bestArtistFromSong.getProperty(SBProperties.artistName)]));
              this._fixedResultArtists[artistName] = bestArtistFromSong.getProperty(SBProperties.artistName);
              var candidateTrack = this.makeCandidateTrackFromMediaItem(bestArtistFromSong, track, score);
              this._candidateTracks.addOrUpdate(candidateTrack);
              this._candidateArtists.addOrUpdate(this.makeCandidateArtistFromMediaItem(bestArtistFromSong, score));
              foundTracks++;
            }
            // Otherwise, use it as a recommendation
            else {
              var candidateTrack = this.makeCandidateTrackFromDetails(trackName, artistName, track, score, url, streamable);
              this._candidateTracks.addOrUpdate(candidateTrack);
              this._candidateArtists.addOrUpdate(this.makeCandidateArtistFromDetails(artistName, score));
            }
          }
        }
        // No fuzzy matching
        else {
          var candidateTrack = this.makeCandidateTrackFromDetails(trackName, artistName, track, score, url, streamable);
          this._candidateTracks.addOrUpdate(candidateTrack);
          this._candidateArtists.addOrUpdate(this.makeCandidateArtistFromDetails(artistName, score));
        }
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
      case Ci.sbIMediacoreEvent.TRACK_CHANGE :
        this._trackTreeView.treebox.invalidate();
        break;
    }
  },
  
  processArtist: function(artist) {
    if (!this._doSimilarArtists && !this._doTracksFromArtist && !this._doTopTracks && !this._doArtistTopAlbums) {
      artist.processed = true;
      return;
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
        return;
      }
    }
    
    var artistName = artist.artistName;
    if (this._fixedQueryArtists[artistName] != null) {
      artistName = this._fixedQueryArtists[artistName];
    }
  
    this.addOutputText(this._strings.getFormattedString("processingArtistOutputText", [artistName]));
    
    if (this._doSimilarArtists) {    
      this.findSimilarArtists(artist, artistName);
      if (!this._processing) {
        return;
      }
    }
    
    if (this._doTracksFromArtist) {
      this.addTracksFromSimilarArtist(artist);
      if (!this._processing) {
        return;
      }
    }
    
    if (this._doTopTracks) {
      this.findTopTracks(artist, artistName);
      if (!this._processing) {
        return;
      }
    }
    
    if (this._doArtistTopAlbums) {
      this.findTopAlbums(artist, artistName);
      if (!this._processing) {
        return;
      }
    }
    
    this.updateArtistList();
    artist.processed = true;
    this._numProcessed++;
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
        return;
      }

      this.addOutputText(this._strings.getString("lastfmResponseErrorOutputText"));
      return;
    }

    if (!this._processing) {
      return;
    }

    if (!request.responseXML || request.status != REQUEST_SUCCESS_CODE) {
      this.addOutputText(this._strings.getString("lastfmResponseErrorOutputText"));
      return; 
    }
    
    this.processSimilarArtistXml(artist, request.responseXML);
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
      
      this._candidateArtists.addOrUpdate(this.makeCandidateArtistFromSimilarArtistDetails(artist, artistName, scaledScore, url, imageUrl))
    }
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
        this._candidateTracks.addOrUpdate(this.makeCandidateTrackFromSimilarArtistTopTrackMediaItem(curSongFromArtist, artist, defaultSimilarArtistScore));
        tracksAdded++;
      }
    }
    
    if (tracksAdded == 0) {
      this.addOutputText(this._strings.getString("noTracksFromSimilarArtistOutputText"));
    }
    else {
      this.addOutputText(this._strings.getFormattedString("tracksFromSimilarArtistOutputText", [tracksAdded]));
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
        return;
      }

      this.addOutputText(this._strings.getString("lastfmResponseErrorOutputText"));
      return;
    }

    if (!this._processing) {
      return;
    }

    if (!request.responseXML || request.status != REQUEST_SUCCESS_CODE) {
      this.addOutputText(this._strings.getString("lastfmResponseErrorOutputText"));
      return; 
    }
    
    this.processTopTracksXml(artist, artistName, request.responseXML);
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
          this._candidateTracks.addOrUpdate(this.makeCandidateTrackFromSimilarArtistTopTrackMediaItem(mediaItem, artist, scoreFromTopTrack));
          foundTracks++;
          addedTracks++;
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
        if 
        (
          bestSongFromArtistScore > 0 
          ||
          (bestSongFromArtistScore >= -3 && bestSongFromArtistScore*-1 < trackName.length/2)
        ) {
          this._candidateTracks.addOrUpdate(this.makeCandidateTrackFromSimilarArtistTopTrackMediaItem(bestSongFromArtist, artist, scoreFromTopTrack));
          this.addOutputText(this._strings.getFormattedString("correctedSongOutputText", [artistName, trackName, bestSongFromArtist.getProperty(SBProperties.trackName)]));
          this._fixedResultSongs[trackName] = bestSongFromArtist.getProperty(SBProperties.trackName);
          foundTracks++;
          addedTracks++;
        }
        // Otherwise add the song as a recommendation
        else if (!this._ignoreNotInLibrary)
        {
          this._candidateTracks.addOrUpdate(this.makeCandidateTrackFromSimilarArtistTopTrackDetails(trackName, artistName, artist, scoreFromTopTrack, url, streamable));
          addedTracks++;
        }  
      }
    }
    
    this.addOutputText(this._strings.getFormattedString("foundTopTracksOutputText", [addedTracks, foundTracks]));
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
        return;
      }

      this.addOutputText(this._strings.getString("lastfmResponseErrorOutputText"));
      return;
    }

    if (!this._processing) {
      return;
    }

    if (!request.responseXML || request.status != REQUEST_SUCCESS_CODE) {
      this.addOutputText(this._strings.getString("lastfmResponseErrorOutputText"));
      return; 
    }
    
    this.processTopAlbumsXml(artist, artistName, request.responseXML);    
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
    
    var maxAlbums = this._maxTopAlbums;
    var totalAlbums = albums.length;
    if (totalAlbums < maxAlbums) {
      maxAlbums = totalAlbums;
    }
    
    for (var index = 0; index < maxAlbums; index++) {
    
      var albumNode = albums[index];
      var albumName = this.getAlbumFromAlbumNode(albumNode);
      var url = this.getUrlFromAlbumNode(albumNode);
      //todo use url
      
      // scale top albums linearly
      var score = (maxAlbums - index) / maxAlbums;
      
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
        
      // Only add as a recommendation if it isn't already in the library
      if (!albumFound) {
        this._candidateAlbums.add(this.makeCandidateAlbumFromDetails(artist, albumName, score));
      }
    }
  
    this.addOutputText(this._strings.getFormattedString("foundTopAlbumsOutputText", [maxAlbums]));
    this.updateAlbumTree();
  },
  
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
  
  addArtistInfo: function(artist, score, index) {
    var listBox = document.getElementById('artist-list');
    var listitem = document.createElement("richlistitem");
    var artistInfo = document.createElement("artistinfo");
    artistInfo.setAttribute("class", "artistinfo");
    artistInfo.setAttribute("artistName", artist.artistName);
    artistInfo.setAttribute("artistScore", score.toFixed(2));
    
    if (artist.imageUrl) {
      artistInfo.setAttribute("artistImage", artist.imageUrl);
    }
    else {
      artistInfo.setAttribute("artistImage", "chrome://smarty-pants/skin/default-artist-image.png");
    }
    
    artistInfo.setAttribute("hideArtistImage", !this._showArtistImages);
    artistInfo.setAttribute("hideArtistScore", !this._showArtistScores);
    
    // not displayed
    artistInfo.setAttribute("index", index);

    listitem.appendChild(artistInfo);

    listBox.appendChild(listitem);
  },
  
  clearArtistInfo: function() {
    var listBox = document.getElementById('artist-list');
    while (listBox.lastChild) {
      listBox.removeChild(listBox.lastChild);
    }
  },
  
  updateArtistList: function() {
    this._candidateArtists.sortByScore();
    this.clearArtistInfo();
    var minScore = parseFloat(this._ignoreScoresTextbox.value);
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
  
    if (artist.url == null || artist.url.length == 0) {
      this.findUrlForArtist(artist);
    }
    
    if (artist.url != null) {
      this._gBrowser.loadURI(artist.url, null, null, event, '_blank');
    }
    
    event.stopPropagation();
  },
  
  /* Can't get it to work, do it later
  loadPrefs: function() {
    if (Application.prefs.get("extensions.smarty-pants.song-limit").value) {
      this._playlistLimitToSongsTextbox.value = Application.prefs.get("extensions.smarty-pants.song-limit").value;
    }
    
    if (Application.prefs.get("extensions.smarty-pants.time-limit").value) {
      this._playlistLimitToTimeTextbox.value = Application.prefs.get("extensions.smarty-pants.time-limit").value;
    }
    
    if (Application.prefs.get("extensions.smarty-pants.show-advanced").value) {
      this._showAdvancedOptionsCheckbox.setAttribute("checked", Application.prefs.get("extensions.smarty-pants.show-advanced").value ? "true" : "false");
      this.onShowAdvancedOptionsCheck();
    }
    
    if (Application.prefs.get("extensions.smarty-pants.ignore-duplicate").value) {
      this._ignoreDuplicateMatchesCheckbox.setAttribute("checked", Application.prefs.get("extensions.smarty-pants.ignore-duplicate").value ? "true" : "false");
    }
    
    if (Application.prefs.get("extensions.smarty-pants.auto-correct-source").value) {
      this._tryOtherArtistCheckbox.setAttribute("checked", Application.prefs.get("extensions.smarty-pants.auto-correct-source").value ? "true" : "false");
    }
    
    if (Application.prefs.get("extensions.smarty-pants.auto-correct-results").value) {
      this._fuzzyMatchCheckbox.setAttribute("checked", Application.prefs.get("extensions.smarty-pants.auto-correct-results").value ? "true" : "false");
    }
    
    if (Application.prefs.get("extensions.smarty-pants.score-cutoff").value) {
      this._ignoreScoresTextbox.value = Application.prefs.get("extensions.smarty-pants.score-cutoff").value;
    }
    
    if (Application.prefs.get("extensions.smarty-pants.sim-track-weight").value) {
      this._similarTrackWeightTextbox.value = Application.prefs.get("extensions.smarty-pants.sim-track-weight").value;
    }
    
    if (Application.prefs.get("extensions.smarty-pants.recommendation-filter").value) {
      if (Application.prefs.get("extensions.smarty-pants.recommendation-filter").value == 0) {
        this._recommendationFilterList.selectedItem == this._recommendationFilterAll;
      }
      else if (Application.prefs.get("extensions.smarty-pants.recommendation-filter").value == 1) {
        this._recommendationFilterList.selectedItem == this._recommendationFilterStreamable;
      }
      else if (Application.prefs.get("extensions.smarty-pants.recommendation-filter").value == 2) {
        this._recommendationFilterList.selectedItem == this._recommendationFilterFull;
      }
    }
  },
  
  savePrefs: function() {
  
    if (!this._loaded) {
      return;
    }
  
    Application.prefs.setValue("extensions.smarty-pants.song-limit", parseInt(this._playlistLimitToSongsTextbox.value));
    Application.prefs.setValue("extensions.smarty-pants.time-limit", parseInt(this._playlistLimitToTimeTextbox.value));
    Application.prefs.setValue("extensions.smarty-pants.show-advanced", this._showAdvancedOptionsCheckbox.getAttribute("checked") == "true");
    Application.prefs.setValue("extensions.smarty-pants.ignore-duplicate", this._ignoreDuplicateMatchesCheckbox.getAttribute("checked") == "true");
    Application.prefs.setValue("extensions.smarty-pants.auto-correct-source", this._tryOtherArtistCheckbox.getAttribute("checked") == "true");
    Application.prefs.setValue("extensions.smarty-pants.auto-correct-results", this._fuzzyMatchCheckbox.getAttribute("checked") == "true");
    Application.prefs.setValue("extensions.smarty-pants.score-cutoff", parseFloat(this._ignoreScoresTextbox.value));
    Application.prefs.setValue("extensions.smarty-pants.sim-track-weight", parseFloat(this._similarTrackWeightTextbox.value));
    
    if (this._recommendationFilterList.selectedItem == this._recommendationFilterStreamable) {
      Application.prefs.setValue("extensions.smarty-pants.recommendation-filter", 1);
    }
    else if (this._recommendationFilterList.selectedItem == this._recommendationFilterFull) {
      Application.prefs.setValue("extensions.smarty-pants.recommendation-filter", 2);
    }
    else {
      Application.prefs.setValue("extensions.smarty-pants.recommendation-filter", 0);
    }
  },
  */
  
  
};

window.addEventListener("load", function(e) { SmartyPants.PaneController.onLoad(e); }, false);
window.addEventListener("unload", function(e) { SmartyPants.PaneController.onUnLoad(e); }, false);

