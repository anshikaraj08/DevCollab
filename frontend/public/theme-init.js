// Apply the saved theme before first paint to avoid a light/dark flash.
// Kept as a static file (not inline) so the CSP can forbid inline scripts.
(function () {
  try {
    var t = localStorage.getItem("theme");
    if (t === "light") {
      document.documentElement.classList.remove("dark");
    } else {
      document.documentElement.classList.add("dark");
    }
  } catch (_) {
    // storage unavailable: keep the default dark theme
  }
})();
