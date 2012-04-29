media-overlays-js
=================

EPUB Media Overlays javascript implementation

This is a partial implementation of EPUB Media Overlays.  

# Run test

(first time)
Get Ruby 1.9.x, install it, and run:

    $ gem install bundle
    $ bundle install

Then (every time), start the local server in the source code directory with 

    $ rake server

Navigate to http://localhost:4000/mo.html and press "play"

# Use

Dependencies: jQuery 1.7.x

How to use the MediaOverlaysPlayer

    moPlayer = new MediaOverlaysPlayer
    moPlayer.playFile(url)

Where url is a SMIL file.

You also have access to the audio player:
    
    audioPlayer = moPlayer.getAudioPlayer();

Which can tell you if the file is playing or not and lets you pause and resume playback.
    
    if (audioPlayer.isPlaying()) {
        audioPlayer.pause();
    }
    else {
        audioPlayer.resume();
    }

# Future additions

 * Start playback from an offset, e.g. file.smil#ID
 * Means to translate a text ID into a SMIL offset
 * Attach text renderer to Readium's text display 
 * Text renderer toggles CSS class (given in package file metadata)

# Approach 

Parse a single SMIL file and annotate the XML DOM as follows:

(All nodes)
Node.render = function to render that node

(All nodes)
Node.notifyChildDone = function called when the node's child is done rendering

(Body and Seq nodes only)
Node.playbackIndex = index of the currently-playing child node

The SMIL tree plays itself, calling

    root->render

which in turn renders its children.

Media nodes are hooked up to external renderers for text display and audio clip playback.

Time container nodes (e.g. seq, par, body) are hooked up to internal renderers to manage playback of their child nodes.

When a node is done playing, it must notify its parent via the Node.notifyChildDone method.  This method is also used to communicate from the audio clip player to the audio node that owns that clip.