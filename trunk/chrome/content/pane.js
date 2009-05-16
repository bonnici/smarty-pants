// Variables for convience
var Cc = Components.classes;
var Ci = Components.interfaces;
var Cu = Components.utils;
var Cr = Components.results;

if (typeof SmartyPants == 'undefined') {
  var SmartyPants = {};
}

/**
 * Controller for pane.xul
 */
SmartyPants.PaneController = {
  
  onLoad: function() {
  },
  
  onUnLoad: function() {
  }
  
};

window.addEventListener("load", function(e) { SmartyPants.PaneController.onLoad(e); }, false);
window.addEventListener("unload", function(e) { SmartyPants.PaneController.onUnLoad(e); }, false);

