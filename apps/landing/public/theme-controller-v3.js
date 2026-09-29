(() => {
  const key = "da-theme";
  const root = document.documentElement;
  const media = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

  const readStored = () => {
    try {
      const value = localStorage.getItem(key);
      return value === "day" || value === "night" ? value : null;
    } catch {
      return null;
    }
  };

  const apply = (theme, persist = false) => {
    const safe = theme === "night" ? "night" : "day";
    root.dataset.theme = safe;
    root.style.colorScheme = safe === "night" ? "dark" : "light";

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", safe === "night" ? "#07110f" : "#f4f0e7");

    document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
      button.dataset.activeTheme = safe;
      button.setAttribute("aria-pressed", String(safe === "night"));
      const nextTitle = safe === "night" ? button.dataset.dayTitle : button.dataset.nightTitle;
      if (nextTitle) {
        button.setAttribute("title", nextTitle);
        button.setAttribute("aria-label", nextTitle);
      }
    });

    if (persist) {
      try {
        localStorage.setItem(key, safe);
      } catch {}
    }
  };

  const stored = readStored();
  const initial = stored || (media && media.matches ? "night" : "day");
  apply(initial);

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const toggle = target.closest("[data-theme-toggle]");
    if (toggle) {
      event.preventDefault();
      event.stopPropagation();
      apply(root.dataset.theme === "night" ? "day" : "night", true);
      return;
    }

    const navLink = target.closest(".mobile-nav-panel a");
    if (navLink) {
      const details = navLink.closest("details.mobile-nav");
      if (details) details.removeAttribute("open");
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    document.querySelectorAll("details.mobile-nav[open]").forEach((details) => details.removeAttribute("open"));
  });

  const syncControls = () => apply(root.dataset.theme || initial);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", syncControls, { once: true });
  } else {
    syncControls();
  }

  if (media) {
    const followSystem = (event) => {
      if (!readStored()) apply(event.matches ? "night" : "day");
    };
    if (media.addEventListener) media.addEventListener("change", followSystem);
    else if (media.addListener) media.addListener(followSystem);
  }
})();
