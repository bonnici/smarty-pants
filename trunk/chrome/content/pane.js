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
    this._outputCheckbox = document.getElementById("output-textbox");
    
    this._addButton.addEventListener("command", 
          function() { controller.addSelectedTracks(); }, false);
    this._clearButton.addEventListener("command", 
          function() { controller.clearAllTracks(); }, false);
          
    this._candidateTracks = {
      dataArray: [],
      
      addOrUpdate: function(candidateTrack) {
        for (var index = 0; index < this.dataArray.length; index++) {
          var curTrack = this.dataArray[index];
          var tracksAreEqual = this._tracksAreEqual(curTrack, candidateTrack);
          if (tracksAreEqual) {
            curTrack.score += candidateTrack.score;
            if (curTrack.score > 1) {
              curTrack.score = 1;
            }
            controller.addOutputText(controller._strings.getFormattedString("updatedTrackOutputText", [candidateTrack.artist, candidateTrack.track]));
            
            return;
          }
        }
        
        controller.addOutputText(controller._strings.getFormattedString("addedTrackOutputText", [candidateTrack.artist, candidateTrack.track]));
        this.dataArray.push(candidateTrack);
      },
      
      clear: function() {
        this.dataArray = [];
      },
      
      sortByScore: function() {
        this.dataArray.sort(this.sortByScoreFunc);
      },
      
      sortByScoreFunc: function(a, b) {
        return a.score < b.score;
      },
      
      _tracksAreEqual: function(track1, track2) {
        var tracksAreEqual = 
          track1.track.length == track2.track.length 
          && 
          track1.track.toLowerCase().indexOf(track2.track.toLowerCase()) != -1
          &&
          track1.artist.length == track2.artist.length 
          && 
          track1.artist.toLowerCase().indexOf(track2.artist.toLowerCase()) != -1;
        
        return tracksAreEqual;
      }
    };
    
    this._trackTreeView = {  
        dataArray: [],
        rowCount: 0,
        getCellText : function(row,column) {  
          if (column.id == "track-list-title-column") return this.dataArray[row].trackName;
          else if (column.id == "track-list-artist-column") return this.dataArray[row].artistName;
          //temp else if (column.id == "track-list-album-column") return this.dataArray[row].albumName;
          else if (column.id == "track-list-album-column") return this.dataArray[row].score;
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
            this.dataArray.push({trackName: curTrack.track, artistName: curTrack.artist, albumName: curTrack.album, score: curTrack.score}); 
          }
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
      this._candidateTracks.addOrUpdate(this._makeCandidateTrackFromMediaItem(item, 0.4));
    }
    
    this._updateTrackTree();
  },
  
  _makeCandidateTrackFromMediaItem: function(mediaItem, aScore) {
    var candidiateTrack = {
      score: aScore,
      track: mediaItem.getProperty(SBProperties.trackName),
      artist: mediaItem.getProperty(SBProperties.artistName),
      album: mediaItem.getProperty(SBProperties.albumName),
      relatedTracks: {},
      relatedTo: {}
    }
    return candidiateTrack;
  },
  
  clearAllTracks: function() {
    this._candidateTracks.clear();
    this._updateTrackTree();
    
    this.addOutputText(this._strings.getString("clearedListOutputText"));
  },
  
  addOutputText: function(text) {
    this._outputCheckbox.value += text;
  },
  
  _updateTrackTree: function() {
    this._candidateTracks.sortByScore();
    this._trackTreeView.update(this._candidateTracks);
    this._trackTree.view = this._trackTreeView;
  }
  
};

window.addEventListener("load", function(e) { SmartyPants.PaneController.onLoad(e); }, false);
window.addEventListener("unload", function(e) { SmartyPants.PaneController.onUnLoad(e); }, false);

