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
const REQUEST_SUCCESS_CODE = 200;

if (typeof SmartyPants == 'undefined') {
  var SmartyPants = {};
}

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
    //this._outputTextbox = document.getElementById("output-textbox");
    this._outputTree = document.getElementById("output-tree");
    this._ignoreDuplicateMatchesCheckbox = document.getElementById("ignore-duplicate-matches-checkbox");
    this._showAdvancedOptionsCheckbox = document.getElementById("show-advanced-options-checkbox");
    this._advancedOptionsGroup = document.getElementById("advanced-options-group");
    this._showDetailsCheckbox = document.getElementById("show-details-checkbox");
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
    this._showDetailsCheckbox.addEventListener("command", 
          function() { controller.onShowDetailsCheck(); }, false);
    this._recommendationFilterList.addEventListener("command", 
          function() { controller.onRecommendationFilterCommand(); }, false);
          
    this._recommendationFilterSelection = 0;
          
    this._candidateTracks = {
      dataArray: [],
      
      addOrUpdate: function(candidateTrack) {
        for (var index = 0; index < this.dataArray.length; index++) {
          var curTrack = this.dataArray[index];
          var tracksAreEqual = this.tracksAreEqual(curTrack, candidateTrack);
          if (tracksAreEqual) {
            if (!controller._ignoreDuplicateMatches) {
              if (candidateTrack.relatedTo.length > 0) {
                // should only ever be 1 parent max
                curTrack.relatedTo.push({track: candidateTrack.relatedTo[0].track, score: candidateTrack.relatedTo[0].score});
                curTrack.needsRescoring = true;
              }
              //controller.addOutputText(controller._strings.getFormattedString("updatedTrackOutputText", [candidateTrack.artist, candidateTrack.trackName]));
            }
            else {
              //controller.addOutputText(controller._strings.getFormattedString("ignoredDuplicateTrackOutputText", [candidateTrack.artist, candidateTrack.trackName]));
            }
            return;
          }
        }
        
        //controller.addOutputText(controller._strings.getFormattedString("addedTrackOutputText", [candidateTrack.artist, candidateTrack.trackName]));
        this.dataArray.push(candidateTrack);
      },
      
      clear: function() {
        this.dataArray = [];
      },
      
      sortByScore: function() {
        this.rescore();
        this.dataArray.sort(this.sortByScoreFunc);
      },
      
      sortByScoreFunc: function(a, b) {
        return a.score < b.score;
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
      },
      
      scoreTrack: function(track) {
        //controller.addOutputText("scoring " + track.trackName + "\n");
        
        if (!track.needsRescoring) {
          //controller.addOutputText("already scored\n");
          return track.score;
        }
        
        if (track.isGettingScored) {
          //controller.addOutputText("infinite loop protection\n");
          return -1; // Don't infinite loop
        }
        
        if (track.seedTrack) {
          //controller.addOutputText("seed track\n");
          track.needsRescoring = false;
          return 1;
        }
        else {
          var score = 0;
          var properScoreFound = false;
          track.isGettingScored = true;
          for (var index = 0; index < track.relatedTo.length; index++) {
            var parentsScore = this.scoreTrack(track.relatedTo[index].track);
            if (parentsScore >= 0) {
              properScoreFound = true;
              //controller.addOutputText("parent " + track.relatedTo[index].track.artist + " - " + track.relatedTo[index].track.trackName + " with score " + track.relatedTo[index].score + "\n");
              score += (track.relatedTo[index].score / track.relatedTo[index].track.maxSimilarityScore) * parentsScore * controller._similarTrackWeight; 
              //controller.addOutputText("score += (" + track.relatedTo[index].score + " / " + track.relatedTo[index].track.maxSimilarityScore + ") * " + parentsScore + " * " + controller._similarTrackWeight + " = " + score + "\n");
            }
          }
          track.isGettingScored = false;
          
          if (!properScoreFound) {
            //controller.addOutputText("no parents found, infinite loop protection\n");
            return -1;
          }
          
          if (score > 0.99999) {
            score = 0.99999;
          }
          
          //controller.addOutputText("score is " + score + "\n");
          track.needsRescoring = false;
          return score;
        }
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
          var minScore = parseFloat(controller._ignoreScoresTextbox.value);
          for (var index = 0; index < candidateTracks.dataArray.length; index++) {
            var curTrack = candidateTracks.dataArray[index];
            if (curTrack.guid != null && curTrack.score >= minScore) {
              this.dataArray.push({trackName: curTrack.trackName, artistName: curTrack.artist, albumName: curTrack.album, score: curTrack.score, guid: curTrack.guid}); 
            }
          }
          this.rowCount = this.dataArray.length; 
        } 
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
            if (curTrack.guid == null && curTrack.score >= minScore && curTrack.streamable >= controller._recommendationFilterSelection) {
              this.dataArray.push(
                    {
                      trackName: curTrack.trackName, 
                      artistName: curTrack.artist, 
                      albumName: curTrack.album, 
                      score: curTrack.score, 
                      streamable: curTrack.streamable, 
                      url: curTrack.url
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
    
    this._windowMediator = Cc["@mozilla.org/appshell/window-mediator;1"]
                            .getService(Ci.nsIWindowMediator);
                            
    this._mediaCoreManager = Cc["@songbirdnest.com/Songbird/Mediacore/Manager;1"]  
                            .getService(Components.interfaces.sbIMediacoreManager);  
                            
    this._gBrowser = this._windowMediator.getMostRecentWindow("Songbird:Main").gBrowser;
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
  
  onShowDetailsCheck: function() {
    if (this._showDetailsCheckbox.getAttribute("checked") == "true") {
      this._detailsGroup.setAttribute("hidden", "false");
    }
    else {
      this._detailsGroup.setAttribute("hidden", "true");
    }
  },
  
  onTrackTreeDoubleClick: function(event) {
    var clickedIndex = this._trackTree.treeBoxObject.getRowAt(event.clientX, event.clientY);
    
    if (clickedIndex >= 0 && clickedIndex < this._trackTreeView.dataArray.length)
    {
      var clickedItem = this._trackTreeView.dataArray[clickedIndex];
    }
    /*
    var sourceMediaListView = this._mediaCoreManager.sequencer.view;
    var targetMediaListView = targetMediaList.createView();
    */
    
    //alert("track tree dclick at " + clickedIndex);
    
    //todo
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
        this._gBrowser.loadURI(url, null, null, null);
      }
    }
  },
  
  addSelectedTracks: function() {
    var songbirdWindow = this._windowMediator.getMostRecentWindow("Songbird:Main");     
    var mediaListView = songbirdWindow.gBrowser.currentMediaListView;

    if (mediaListView == null)
    {
      return;
    }

    var selection = mediaListView.selection;
    var itemEnum = selection.selectedMediaItems;

    while (itemEnum.hasMoreElements())
    {
      var item = itemEnum.getNext();
      this._candidateTracks.addOrUpdate(this.makeCandidateTrackFromMediaItem(item, null, 1));
    }
    
    this.updateTrackTree();
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
      streamable: 0
    }
    
    if (parentTrack != null) {
      candidiateTrack.relatedTo.push({track: parentTrack, score: score});
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
      streamable: streamable
    }

    if (parentTrack != null) {
      candidiateTrack.relatedTo.push({track: parentTrack, score: score});
    }

    return candidiateTrack;
  },
  
  clearAllTracks: function() {
    this._candidateTracks.clear();
    this.updateTrackTree();
    this.clearOutputText();
  },
  
  addOutputText: function(text) {
    this._outputTreeView.dataArray.push(text);
    this._outputTreeView.update();
    this._outputTree.view = this._outputTreeView;
    
    var boxobject = this._outputTree.boxObject;
    boxobject.scrollToRow(this._outputTreeView.dataArray.length - 5);
  },
  
  clearOutputText: function(text) {
    this._outputTreeView.dataArray = [];
    this._outputTreeView.update();
    this._outputTree.view = this._outputTreeView;
  },
  
  updateTrackTree: function() {
    this._candidateTracks.sortByScore();
    this._trackTreeView.update(this._candidateTracks);
    this._trackTree.view = this._trackTreeView;
    this._recommendationTreeView.update(this._candidateTracks);
    this._recommendationTree.view = this._recommendationTreeView;
  },
  
  startOrStopProcessing: function() {
    if (this._processing) {
      this.stopProcessing();
    }
    else {
      this.startProcessing();
    }
  },
  
  stopProcessing: function() {
    this._processing = false;
    this.enableButtons(true);
    this._goButton.setAttribute("label", this._strings.getString("goButtonGo"));
  },
  
  startProcessing: function() {
    this._processing = true;
    this.enableButtons(false);
    this._goButton.setAttribute("label", this._strings.getString("goButtonStop"));
    this._ignoreDuplicateMatches = (this._ignoreDuplicateMatchesCheckbox.getAttribute("checked") == "true" ? true : false);
    this._similarTrackWeight = parseFloat(this._similarTrackWeightTextbox.value);
    
    setTimeout("SmartyPants.PaneController.doProcessNextTrack()", 0);
  },
  
  enableButtons: function(enable) {
    var disabled = enable ? "false" : "true";
    this._addButton.setAttribute("disabled", disabled);
    this._saveButton.setAttribute("disabled", disabled);
    this._clearButton.setAttribute("disabled", disabled);
  },
  
  doProcessNextTrack: function() {
    
    if (this._processing) {
      for (var index = 0; index < this._candidateTracks.dataArray.length; index++) {
        var curTrack = this._candidateTracks.dataArray[index];
        var minScore = parseFloat(this._ignoreScoresTextbox.value);
        if (!curTrack.processed && curTrack.score >= minScore) {
          this.processTrack(curTrack);
      
          setTimeout("SmartyPants.PaneController.doProcessNextTrack()", 0);
          return;
        }
      }
      
      // All tracks are processed, stop processing
      this.addOutputText(this._strings.getString("allSongsProcessedOutputText"));
      this.stopProcessing();
    }
    
  },
  
  processTrack: function(track) {
    this.addOutputText(this._strings.getFormattedString("processingTrackOutputText", [track.artist, track.trackName]));
    
    var requestUri = LAST_FM_ROOT_URL + "?method=" + TRACK_GETSIMILAR_METHOD + 
                        "&track=" + track.trackName +
                        "&artist=" + track.artist +
                        "&api_key=" + LAST_FM_API_KEY;

    var request = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Ci.nsIXMLHttpRequest);

    //alert(requestUri);
    //this.addOutputText(requestUri);

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
      track.processed = true;
      return;
    }

    if (!this._processing) {
      return;
    }

    if (!request.responseXML || request.status != REQUEST_SUCCESS_CODE) {
      this.addOutputText(this._strings.getString("lastfmResponseErrorOutputText"));
      track.processed = true;
      return; 
    }
    
    //alert(request.responseText);

    this.parseSimilarTrackXml(track, request.responseXML);
    track.processed = true;
  },
  
  parseSimilarTrackXml: function(track, xml) {
    
    var mainElement = xml.getElementsByTagName('similartracks');
    if (mainElement == null || mainElement.length < 1) {
      this.addOutputText(this._strings.getFormattedString("noSimilarTracksOutputText", [track.artist, track.trackName]));
      return;
    }
    
    var tracks = mainElement[0].getElementsByTagName('track');
    if (tracks.length < 1) {
      this.addOutputText(this._strings.getFormattedString("noSimilarTracksOutputText", [track.artist, track.trackName]));
      return;
    }
    
    var foundTracks = 0;
    var totalTracks = tracks.length;
    
    for (var index = 0; index < totalTracks; index++) {
      
      trackNode = tracks[index];
      var artistName = this.getArtistFromTrackNode(trackNode);
      var trackName = this.getTrackFromTrackNode(trackNode);
      var score = this.getScoreFromTrackNode(trackNode);
      var url = this.getUrlFromTrackNode(trackNode);
      var streamable = this.getStreamableFromTrackNode(trackNode);
      
      if (score+1 > track.maxSimilarityScore) {
        track.maxSimilarityScore = score+1;
      }
      
      var songProps = Cc["@songbirdnest.com/Songbird/Properties/MutablePropertyArray;1"]
       	                  .createInstance(Ci.sbIMutablePropertyArray);
      songProps.appendProperty(SBProperties.artistName, artistName);  
      songProps.appendProperty(SBProperties.trackName, trackName);

      try {
      	var itemEnum = LibraryUtils.mainLibrary.getItemsByProperties(songProps).enumerate();
      	if (itemEnum.hasMoreElements()) {
        	var item = itemEnum.getNext();
        	var candidateTrack = this.makeCandidateTrackFromMediaItem(item, track, score);
        	this._candidateTracks.addOrUpdate(candidateTrack);
        	foundTracks++;
    		}
  		}
    	catch (e) {
    	  var candidateTrack = this.makeCandidateTrackFromDetails(trackName, artistName, track, score, url, streamable);
    	  this._candidateTracks.addOrUpdate(candidateTrack);
    	}

    }
    
    this.addOutputText(this._strings.getFormattedString("foundSimilarTracksOutputText", [totalTracks, foundTracks]));
    this.updateTrackTree();
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
  }
  
};

window.addEventListener("load", function(e) { SmartyPants.PaneController.onLoad(e); }, false);
window.addEventListener("unload", function(e) { SmartyPants.PaneController.onUnLoad(e); }, false);

