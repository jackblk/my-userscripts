// ==UserScript==
// @name         Facebook video default volume
// @author       https://github.com/jackblk/
// @namespace    http://tampermonkey.net/
// @version      1.1
// @updateURL		 https://github.com/jackblk/my-userscripts/raw/main/facebook-default-volume.user.js
// @downloadURL	 https://github.com/jackblk/my-userscripts/raw/main/facebook-default-volume.user.js
// @description  Set default volume for all video player in Facebook
// @include      https://facebook.com/*
// @include      https://www.facebook.com/*
// ==/UserScript==

var defaultVolume = 0.3;

function findVideoPlayer() {
  return document.querySelectorAll("video");
}

function compareVideoNode(firstNode, secondNode) {
  if (firstNode.length !== secondNode.length) return false;
  for (let i = 0; i < firstNode.length; i++) {
    // If clientWidth size changes when FB pops out video player
    // then consider it as a new node to reset the default volume
    if (
      firstNode[i] !== secondNode[i] &&
      firstNode[i].clientWidth !== secondNode[i].clientWidth
    )
      return false;
  }
  return true;
}

var videos = findVideoPlayer();
var observer = new MutationObserver(function (mutations) {
  var videosNew = findVideoPlayer();
  if (!compareVideoNode(videos, videosNew)) {
		console.log("New video found, setting to default volume.")
    videos = videosNew;
    for (let video of videos) {
      // Set the default volume when any video player element is created
      video.volume = defaultVolume;
      // Set properties to check when FB resizes the video player element
      video.lastVolume = video.volume;
      video.lastClientWidth = video.clientWidth;
			video.totalVolumeChange = 0;

      video.addEventListener("volumechange", (e) => {
        // If the size changes by FB or it's the first volume change, reset the default volume
        if (e.target.lastClientWidth !== e.target.clientWidth || e.target.totalVolumeChange == 0) {
          e.target.volume = defaultVolume;
          console.log(
            `Setting default volume ${e.target.volume} vs ${e.target.lastVolume}\n` +
              `New size ${e.target.clientWidth} vs ${e.target.lastClientWidth}`
          );
        }
        // Otherwise, let the volume change & remember it
        e.target.lastVolume = e.target.volume;
        e.target.lastClientWidth = e.target.clientWidth;
				e.target.totalVolumeChange++;
      });
    }
  }
});

observer.observe(document, {
  attributes: false,
  childList: true,
  characterData: false,
  subtree: true,
});
