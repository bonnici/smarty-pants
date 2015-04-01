# Basics #

All tracks and artists have a score, which represents the similarity to the "seed" tracks or artists, which are the ones that you add from your playlist. This score can be shown by using the show/hide columns button at the top right of the track and artist lists. The score is used to determine the track or artist's position in the lists, as well as to decide what gets investigated next. Every time a track or artist is processed, Smarty Pants will look for the next highest scoring track or artist and process that one. What that means is that Smarty Pants will try to find the tracks related to the song you add, then try to find the related artists and top tracks of the artist, then move on to the next most similar track or artist, depending on what has the highest score.

Scores are always in the range of 0 to 1, and the score of the seed tracks and artists is always 1.

# Track Scoring #

Track scores can come from one of two sources - either from being a similar track to another track or from being a top track from an artist. If a track happens to have both scores, the biggest one is used. The way this works is that after some number of tracks from the same artist have been encountered (the default is 3), tracks will start to get penalised by having their score multiplied by the maximum unpenalised number of tracks divided by number of tracks encountered so far. So for example using the default of 3 unpenalised tracks, the fourth track will be multiplied by 3/4 (0.75), the fifth track will be multiplied by 3/5 (0.6), the sixth by 3/6 (0.5), and so on.

## Similar Track Scores ##

To find similar tracks, Smarty Pants uses the <a href='http://www.last.fm/api/show?service=319'>track.getSimilar</a>  function from last.fm's API. This provides a list of tracks with a number representing how close the tracks are. Since this number does not have a maximum, and score of the most similar track varies quite a lot, the track similarity score is calculated as (track score)/(max track score + 1). For example, if three similar tracks are found with scores 28, 21, and 15, the calculated score will be 28/29 (0.96), 21/29 (0.72), and 15/29 (0.52). This score is then multiplied by the parent track's score, so if the previous examples were similar to the seed track, the scores would be multiplied by 1 and stay the same, but if a track was found to be similar to the track with the score of 0.72 and it had a score of 0.54, it's final score would be 0.72\*0.52=0.37.

## Top Track Scores ##

When an artist is processed, its top tracks are found using the last.fm API function <a href='http://www.last.fm/api/show?service=277'>artist.getTopTracks</a>. These tracks are then given a score based on the number of top tracks found (or the maximum top tracks) and their rank in the list. This is calculated as 1 minus (the rank of the track divided by (the number of top tracks plus 1)). For example, if an artist had 10 top tracks, the score given to the tracks would be 1-(1/(10+1)) = 0.91, 1-(2/(10+1)) = 0.82, etc, 1-(10/(10+1)) = 0.09. This score is then multiplied by the artist's score.

# Diminishing Returns #

There is also an option to add diminishing returns to the scores of tracks from the same artist. This is intended to be used to force more variety into the track list by applying a penalty to tracks if their artist is already in the list a number of times.

# Artist Scoring #

Artist scores are made up of two separate scores, a certain percentage (default is 30%) comes from the results of the tracks in the playlist and recommended list, and the rest comes from the similar artist score.

## Score From Tracks ##

Whenever a track is scored, the score of the track gets accumulated into the artist. After all the tracks have been added, the maximum value of this accumulated track score is found, and the "Score From Tracks" part of the artist's score gets calculated as the accumulated score divided by the max accumulated track score plus 1. As an example, consider an artist with 5 tracks that have a total score of 3.4, and an artist with 10 tracks that have a score of 2.9, The "Score From Tracks" part of the artist score would then be 3.4/4.4 = 0.7 for the first track and 2.9/4.4=0.66 for the second track.

## Similar Artist Scores ##

This is very similar to the similar track score, but uses the <a href='http://www.last.fm/api/show?service=277'>artist.getSimilar</a> function from the last.fm API. However, since that function returns scores that always start at 100, there is no need to figure out the max score, it is just the result from the function divided by 101. The score from tracks and the similar artist score are then scaled by whatever percentage they each are and added together. So if an artist got a score of 0.7 from the tracks and 0.8 from the similar artist, and the percentages were 30% and 70%, the final score would be 0.7\*0.3 + 0.8\*0.7 = 0.77.