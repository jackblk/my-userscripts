// ==UserScript==
// @name         Facebook video default volume
// @author       https://github.com/jackblk/
// @namespace    http://tampermonkey.net/
// @version      2.0
// @updateURL		 https://github.com/jackblk/my-userscripts/raw/main/facebook-default-volume.user.js
// @downloadURL	 https://github.com/jackblk/my-userscripts/raw/main/facebook-default-volume.user.js
// @description  Remember your volume and mute state for all Facebook videos and reels
// @include      https://facebook.com/*
// @include      https://www.facebook.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

// Used until you change the volume yourself for the first time
var defaultState = { volume: 0.3, muted: false };
var storageKey = "fbDefaultVolume";
// How long after a click / key press a volume change still counts as yours
var gestureWindowMs = 500;
var debug = false;

function log() {
  if (debug) console.log.apply(console, ["[fb-volume]"].concat([].slice.call(arguments)));
}

function loadState() {
  try {
    var saved = JSON.parse(localStorage.getItem(storageKey));
    if (saved && typeof saved.volume === "number" && typeof saved.muted === "boolean") return saved;
  } catch (e) {}
  return { volume: defaultState.volume, muted: defaultState.muted };
}

function saveState() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
  } catch (e) {}
}

var state = loadState();

// --- User gesture tracking ---
// FB's own player code and FB's volume controls both set video.volume, so the
// only way to tell them apart is whether the user just interacted with that player.

var pointerDown = false;
var lastGestureTime = 0;
var lastGestureTarget = null;
var hasUserActivation = false;

function onGesture(event) {
  lastGestureTime = Date.now();
  lastGestureTarget = event.target instanceof Element ? event.target : document.activeElement;
  hasUserActivation = true;
}

window.addEventListener("pointerdown", function (e) { pointerDown = true; onGesture(e); }, true);
window.addEventListener("pointerup", function (e) { pointerDown = false; onGesture(e); }, true);
window.addEventListener("pointercancel", function () { pointerDown = false; }, true);
window.addEventListener("keydown", onGesture, true);

// Browsers block unmuted autoplay until the user has interacted with the page,
// and unmuting a playing video before that pauses it
function canUnmute() {
  if (navigator.userActivation) return navigator.userActivation.hasBeenActive;
  return hasUserActivation;
}

// The gesture belongs to this video if the smallest element containing both the
// gesture target and the video holds no other video. This stops scrolling or
// clicking one reel from counting as a volume change on the next one.
function gestureTargetsVideo(video) {
  var node = lastGestureTarget;
  while (node && !node.contains(video)) node = node.parentElement;
  return !!node && node.querySelectorAll("video").length === 1;
}

function isUserChange(video) {
  var recent = pointerDown || Date.now() - lastGestureTime < gestureWindowMs;
  return recent && gestureTargetsVideo(video);
}

// --- Applying and remembering state ---

// Whether each video was silent (muted or at 0) after we last handled it
var wasSilent = new WeakMap();

function isSilent(video) {
  return video.muted || video.volume === 0;
}

function applyState(video) {
  if (video.volume !== state.volume) video.volume = state.volume;
  // Never force-unmute before user activation, or the browser pauses the video
  if (video.muted !== state.muted && (state.muted || canUnmute())) video.muted = state.muted;
}

function rememberUserChange(video) {
  if (isSilent(video)) {
    // Muting: keep the remembered volume for when you unmute
    state.muted = true;
  } else if (wasSilent.get(video) && video.volume === 1) {
    // Unmuting: FB jumps to 100%, restore the remembered volume instead
    state.muted = false;
  } else {
    state.muted = false;
    state.volume = video.volume;
  }
  saveState();
  log("remembered", state);
}

function onVolumeChange(event) {
  var video = event.target;
  if (!(video instanceof HTMLVideoElement)) return;
  // Events caused by our own applyState already match the state
  if (video.volume !== state.volume || video.muted !== state.muted) {
    if (isUserChange(video)) {
      rememberUserChange(video);
    } else {
      log("reverting FB change", { volume: video.volume, muted: video.muted });
    }
    applyState(video);
  }
  wasSilent.set(video, isSilent(video));
}

function onVideoStart(event) {
  var video = event.target;
  if (!(video instanceof HTMLVideoElement)) return;
  applyState(video);
  wasSilent.set(video, isSilent(video));
}

// Media events do not bubble, but capture-phase listeners on window still see
// them, so every video (including ones added later or reused by reels) is covered
window.addEventListener("volumechange", onVolumeChange, true);
window.addEventListener("loadedmetadata", onVideoStart, true);
window.addEventListener("play", onVideoStart, true);
