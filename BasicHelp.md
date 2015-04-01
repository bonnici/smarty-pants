# Basic Usage #

Using Smarty Pants is simple, just select one or more songs and hit the _Start_ button. Smarty Pants will find songs and artist that are similar to the selected songs and display them in three tabs. The _Reset_ button will clear all the tabs and allow you to select another song to start processing.

The _Playlist_ tab shows songs that are in your library, ordered by how similar they are to the selected song or songs. You can double click on the songs in this list to start playing them in Songbird, and after a track finishes it will act like a playlist and go on to the next song or a random song depending on whether shuffle is enabled or not. The playlist can be saved by selecting a number of minutes or tracks, and clicking on the _Save_ button. If both the number of minutes and the number of tracks are set to 0, all the songs in the list will be saved. If you right click on songs in the list, there are options to play the song, to open the song or artist in last.fm, or to play the artist radio.

The _Recommended_ tab shows songs that are similar to the selected song but could not be found in your library. It shows the artist and track name as well as whether or not the song is streamable in last.fm. _No_ means the song cannot be streamed (but there might still be a video that can be played), _Yes_ means that the song can be previewed, and _Full_ means that the whole song can be played and the track might be downloadable. There is a dropdown list down the bottom of the tab that will let you show all songs, only the songs that can be streamed, and only the songs that can be fully streamed. Double clicking on a track will open the song in last.fm and start playing it if it is streamable. If you right click on a track, there are options to open the song or artist in last.fm, or to play the artist radio.

The _Artists_ tab shows the artist that you selected as well as any artists that are similar. It also shows a list of recommended albums for the artist, which are top albums from the artist that you do not have in your library. Clicking on the artist name or picture will open the artist in last.fm, and clicking on the album name or picture will open the album in last.fm. There is also a little red radio icon that can be clicked on to start playing the artist's radio.

# Automatic Mode #

When you tick the _Update automatically_ checkbox, Smarty Pants will automatically start processing any song that is playing, and it will automatically update when the song changes. If you start playing a song in the _Playlist_ tab, this mode can be used to play an unlimited number of related songs back-to-back. The style of music will evolve very slowly if you don't have shuffle enabled, and it will change more rapidly if you have shuffle turned on. If you don't start playing a song in the _Playlist_ tab, this mode can still be useful if you want to see a constantly updating list of suggested tracks or artists and albums.

# Preferences #

There are a number of settings presets that can be selected using the _Preferences_ dropdown list. You can also check the _Show advanced options_ checkbox to manually change all the settings. More information about the presets and the settings can be found by hovering over the preset or setting. A basic description of each of the presets is given below:

## Default ##
Gets the tracks from a number of different sources and should get decent results for most tracks.

## Best results ##
Gets better results than the default but might not work for all songs.

## Quick ##
Choose this for faster results without losing much quality.

## Super quick ##
Choose this for much faster results, but with reduced quality.

## Multiple selection ##
This mode will try to find the songs that best match all the items that you select.

## Varied results ##
This will give harsher penalties to songs from the same artists, leading to results that come from a larger number of artists.

## Artist's top tracks ##
Just gets the top tracks from the artist that is selected.

## Artist and similar top tracks ##
Gets the top tracks from the selected artist and similar artists.

## Artist and album recommendations ##
Only finds related artists and their top albums.

## All from artist and similar ##
Finds all songs in your library from the selected artist and related artists.

## Auto mode ##
Processes less songs and has a more strict score cutoff than the default settings.