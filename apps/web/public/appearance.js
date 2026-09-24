// Applied before styles, without accessing application data.
(function () {
  var style = "creator";
  var theme = "light";
  try {
    style =
      localStorage.getItem("zerodrive-interface-style") === "modern"
        ? "modern"
        : "creator";
    var saved = localStorage.getItem("vite-ui-theme");
    if (saved === "light" || saved === "dark" || saved === "system")
      theme = saved;
  } catch (_) {}
  if (theme === "system")
    theme = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  document.documentElement.dataset.interface = style;
  document.documentElement.classList.add(theme);
  document.documentElement.style.colorScheme = theme;
})();
