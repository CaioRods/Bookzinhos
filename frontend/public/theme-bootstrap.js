document.addEventListener("gesturestart", function (event) { event.preventDefault(); }, { passive: false });
document.addEventListener("gesturechange", function (event) { event.preventDefault(); }, { passive: false });
(function preventDoubleTapZoom() {
  var lastTouch = 0;
  document.addEventListener("touchend", function (event) {
    var now = Date.now();
    if (now - lastTouch <= 300) event.preventDefault();
    lastTouch = now;
  }, { passive: false });
})();
