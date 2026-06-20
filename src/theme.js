(() => {
  const root = document.documentElement;
  const button = document.getElementById("themeToggle");
  if (!button) return;

  const label = button.querySelector(".theme-toggle-text");
  const apply = (theme) => {
    const next = theme === "dark" ? "dark" : "light";
    root.dataset.theme = next;
    button.setAttribute("aria-pressed", String(next === "dark"));
    if (label) label.textContent = next === "dark" ? "深色" : "浅色";
  };

  apply(root.dataset.theme);
  button.addEventListener("click", () => {
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    apply(next);
    try {
      window.localStorage.setItem("ow-theme", next);
    } catch {
      // Theme persistence is optional.
    }
  });
})();
