if (typeof(Cc) == 'undefined')
	var Cc = Components.classes;
if (typeof(Ci) == 'undefined')
	var Ci = Components.interfaces;
if (typeof(Cu) == 'undefined')
	var Cu = Components.utils;
if (typeof(Cr) == 'undefined')
	var Cr = Components.results;
	  
//Cu.import("resource://app/jsmodules/sbProperties.jsm");
//Cu.import("resource://app/jsmodules/sbLibraryUtils.jsm");
//Cu.import("resource://app/jsmodules/kPlaylistCommands.jsm");

// Make a namespace.
if (typeof SmartyPantsMain == 'undefined') {
  var SmartyPantsMain = {};
}

SmartyPantsMain.Controller = {

  onLoad: function() 
  {
    this._insertToolbarItem("nav-bar", "smarty-pants-toolbarbutton", "searchbar-container");
    
    var controller = this;
    
    this._generatePlaylistCmd = document.getElementById("smarty-pants-gen-playlist-cmd");
    this._generatePlaylistCmd.addEventListener("command", 
          function() { controller.generatePlaylist(); }, false);
  },
  
  _insertToolbarItem: function(toolbar, newItem, insertBefore) {
    var toolbar = document.getElementById(toolbar);
    var list = toolbar.currentSet || "";
    list = list.split(",");
    
    // If this item is not already in the current set, add it
    if (list.indexOf(newItem) == -1)
    {
      // Add to the array, then recombine
      insertBefore = list.indexOf(insertBefore);
      if (insertBefore == -1) {
        list.push(newItem);
      } else {
        list.splice(insertBefore - 1, 0, newItem);
      }
      list = list.join(",");
      
      toolbar.setAttribute("currentset", list);
      toolbar.currentSet = list;
      document.persist(toolbar.id, "currentset");
    }
  },
  
  generatePlaylist: function() {
    SmartyPants.PaneController.resetVisiblePlaylist();
    SmartyPants.PaneController.addSelectedTracks();
    SmartyPants.PaneController.startProcessing();
    SmartyPants.PaneController.showPlaylist();
  },
};

window.addEventListener("load", function(e) { SmartyPantsMain.Controller.onLoad(e); }, false);