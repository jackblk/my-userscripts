// ==UserScript==
// @name         Strip tracking params
// @author       https://github.com/jackblk/
// @namespace    http://tampermonkey.net/
// @version      1.0
// @updateURL		 https://github.com/jackblk/my-userscripts/raw/main/strip-tracking-param.user.js
// @downloadURL	 https://github.com/jackblk/my-userscripts/raw/main/strip-tracking-param.user.js
// @description  Remove tracking query params from the current URL and from links on the page
// @match        *://*/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

// Each rule strips `name` from URLs. Set `value` to only strip when it matches,
// or leave it out to strip the param regardless of value.
var trackingParams = [{ name: "utm_source", value: "chatgpt.com" }];

// Links inside the page are only cleaned on these hosts (and their subdomains).
// The address bar is cleaned on every site.
var linkCleanHosts = ["chatgpt.com"];

// Returns the cleaned URL string, or null if nothing was stripped
function stripTracking(href) {
  var url;
  try {
    url = new URL(href, location.href);
  } catch (e) {
    return null;
  }
  var stripped = false;
  for (var i = 0; i < trackingParams.length; i++) {
    var rule = trackingParams[i];
    var current = url.searchParams.get(rule.name);
    if (current === null) continue;
    if (rule.value !== undefined && current !== rule.value) continue;
    url.searchParams.delete(rule.name);
    stripped = true;
  }
  return stripped ? url.toString() : null;
}

function isLinkCleanHost() {
  return linkCleanHosts.some(function (host) {
    return location.hostname === host || location.hostname.endsWith("." + host);
  });
}

function cleanCurrentUrl() {
  var cleaned = stripTracking(location.href);
  if (cleaned) history.replaceState(history.state, "", cleaned);
}

// Pre-filter links by substring so stripTracking only runs on likely matches
var linkSelector = trackingParams
  .map(function (rule) {
    var needle = rule.name + "=" + (rule.value !== undefined ? rule.value : "");
    return 'a[href*="' + needle + '"]';
  })
  .join(",");

function cleanLink(link) {
  var cleaned = stripTracking(link.href);
  if (cleaned) link.href = cleaned;
}

// Cleans the node itself (if it is a tracked link) and all tracked links inside it
function cleanLinks(node) {
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  if (node.matches(linkSelector)) cleanLink(node);
  var links = node.querySelectorAll(linkSelector);
  for (var i = 0; i < links.length; i++) cleanLink(links[i]);
}

cleanCurrentUrl();

if (isLinkCleanHost()) {
  // Catch links rendered after page load (e.g. streamed chat answers)
  new MutationObserver(function (mutations) {
    for (var i = 0; i < mutations.length; i++) {
      var mutation = mutations[i];
      if (mutation.type === "attributes") {
        cleanLinks(mutation.target);
      } else {
        for (var j = 0; j < mutation.addedNodes.length; j++) {
          cleanLinks(mutation.addedNodes[j]);
        }
      }
    }
  }).observe(document, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["href"],
  });

  // Fallback: clean right before navigation in case a link was missed
  document.addEventListener(
    "click",
    function (event) {
      var link = event.target.closest && event.target.closest("a[href]");
      if (!link) return;
      cleanLink(link);
    },
    true
  );
}
