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
    
    this._processing = false;
    this._goButton.setAttribute("label", this._strings.getString("goButtonGo"));
    
    this._addButton.addEventListener("command", 
          function() { controller.addSelectedTracks(); }, false);
    this._goButton.addEventListener("command", 
          function() { controller.startOrStopProcessing(); }, false);
    this._clearButton.addEventListener("command", 
          function() { controller.clearAllTracks(); }, false);
          
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
              //controller.addOutputText("score += (" + track.relatedTo[index].score + " / " + track.relatedTo[index].track.maxSimilarityScore + ") * " + parentsScore + "\n");
              score += (track.relatedTo[index].score / track.relatedTo[index].track.maxSimilarityScore) * parentsScore; 
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
          //temp else if (column.id == "track-list-album-column") return this.dataArray[row].albumName;
          else if (column.id == "track-list-score-column") return this.dataArray[row].score;
          //temp
          else if (column.id == "track-list-inlib-column") return this.dataArray[row].guid != null ? "Yes" : "No";
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
          for (var index = 0; index < candidateTracks.dataArray.length; index++) {
            var curTrack = candidateTracks.dataArray[index];
            this.dataArray.push({trackName: curTrack.trackName, artistName: curTrack.artist, albumName: curTrack.album, score: curTrack.score, guid: curTrack.guid}); 
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
  },
  
  onUnLoad: function() {
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
      maxSimilarityScore: 0
    }
    
    if (parentTrack != null) {
      candidiateTrack.relatedTo.push({track: parentTrack, score: score});
    }
    
    return candidiateTrack;
  },
  
  makeCandidateTrackFromDetails: function(trackName, artistName, parentTrack, score) {
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
      maxSimilarityScore: 0
    }

    if (parentTrack != null) {
      candidiateTrack.relatedTo.push({track: parentTrack, score: score});
    }

    return candidiateTrack;
  },
  
  clearAllTracks: function() {
    this._candidateTracks.clear();
    this.updateTrackTree();
    //this._outputTextbox.value = "";
    this.clearOutputText();
  },
  
  addOutputText: function(text) {
    //this._outputTextbox.value += text;
    this._outputTreeView.dataArray.push(text);
    this._outputTreeView.update();
    this._outputTree.view = this._outputTreeView;
    
    var boxobject = this._outputTree.boxObject;
    boxobject.scrollToRow(this._outputTreeView.dataArray.length - 7);
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
        if (!curTrack.processed) {
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
    this.addOutputText(requestUri);

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
    	  var candidateTrack = this.makeCandidateTrackFromDetails(trackName, artistName, track, score);
    	  this._candidateTracks.addOrUpdate(candidateTrack);
    	}

    }
    
    this.addOutputText(this._strings.getFormattedString("foundSimilarTracksOutputText", [totalTracks, foundTracks]));
    this.updateTrackTree();
  },
  
  getArtistFromTrackNode: function(trackNode) {
    var artistName = "";
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
    var trackName = "";
    var nameElement = trackNode.getElementsByTagName('name');
    if (nameElement != null && nameElement.length > 0) {
      return nameElement[0].textContent;
    }
    
    return "";
  },
  
  getScoreFromTrackNode: function(trackNode) {
    var score = 0;
    var matchElement = trackNode.getElementsByTagName('match');
    if (matchElement != null && matchElement.length > 0) {
      return parseFloat(matchElement[0].textContent);
    }
    
    return 0;
  },
  
};

window.addEventListener("load", function(e) { SmartyPants.PaneController.onLoad(e); }, false);
window.addEventListener("unload", function(e) { SmartyPants.PaneController.onUnLoad(e); }, false);

