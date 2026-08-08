(() => {
  "use strict";

  const initializeSmartLinks = () => {
    document.querySelectorAll("[data-smart-link-lab]").forEach((lab) => {
      if (!(lab instanceof HTMLElement) || lab.dataset.interactionReady === "true") return;
      lab.dataset.interactionReady = "true";
      const status = lab.querySelector("[data-smart-status]");
      lab.querySelectorAll("[data-copy-scheme]").forEach((button) => {
        if (!(button instanceof HTMLButtonElement)) return;
        button.addEventListener("click", async () => {
          const scheme = button.getAttribute("data-copy-scheme") || "";
          const role = button.getAttribute("data-role") || "";
          try {
            await navigator.clipboard.writeText(scheme);
            if (status) status.textContent = `${role.toUpperCase()} · ${scheme} · COPIED`;
          } catch {
            if (status) status.textContent = `${role.toUpperCase()} · ${scheme}`;
          }
        });
      });
    });
  };

  const initializeIntakeSimulator = () => {
    document.querySelectorAll("[data-intake-simulator]").forEach((root) => {
      if (!(root instanceof HTMLElement) || root.dataset.interactionReady === "true") return;
      root.dataset.interactionReady = "true";
      const lang = root.getAttribute("data-lang") || "fr";
      const state = { profile: "", city: "", mobility: "", documents: new Set() };
      const status = root.querySelector("[data-sim-status]");
      const summary = root.querySelector("[data-sim-summary]");
      const progress = root.querySelector("[data-progress-bar]");
      const documentButtons = root.querySelectorAll("[data-document]");
      const choiceButtons = root.querySelectorAll("[data-choice]");

      const update = () => {
        const base = [state.profile, state.city, state.mobility].filter(Boolean).length;
        const completed = base + state.documents.size;
        const total = 8;
        if (progress instanceof HTMLElement) progress.style.width = `${Math.round((completed / total) * 100)}%`;
        const ready = base === 3 && state.documents.size === 5;
        if (status) {
          status.textContent = ready
            ? (lang === "en" ? "READY FOR PRIVATE REVIEW SIMULATION" : "PRÊT POUR LA SIMULATION DE REVUE PRIVÉE")
            : (lang === "en" ? `${completed}/${total} readiness signals` : `${completed}/${total} signaux de préparation`);
        }
        if (summary) summary.textContent = `${state.profile || "—"} · ${state.city || "—"} · ${state.mobility || "—"} · ${state.documents.size}/5 DOCS · MEMORY ONLY`;
        root.classList.toggle("simulator-ready", ready);
      };

      choiceButtons.forEach((button) => {
        if (!(button instanceof HTMLButtonElement)) return;
        button.addEventListener("click", () => {
          const key = button.getAttribute("data-choice");
          const value = button.getAttribute("data-value") || "";
          if (key !== "profile" && key !== "city" && key !== "mobility") return;
          state[key] = value;
          root.querySelectorAll(`[data-choice="${key}"]`).forEach((peer) => peer.classList.toggle("is-selected", peer === button));
          update();
        });
      });

      documentButtons.forEach((button) => {
        if (!(button instanceof HTMLButtonElement)) return;
        button.addEventListener("click", () => {
          const key = button.getAttribute("data-document") || "";
          if (state.documents.has(key)) state.documents.delete(key); else state.documents.add(key);
          const selected = state.documents.has(key);
          button.classList.toggle("is-selected", selected);
          button.setAttribute("aria-pressed", String(selected));
          update();
        });
      });

      const reset = root.querySelector("[data-sim-reset]");
      if (reset) reset.addEventListener("click", () => {
        state.profile = "";
        state.city = "";
        state.mobility = "";
        state.documents.clear();
        root.querySelectorAll(".is-selected").forEach((element) => element.classList.remove("is-selected"));
        documentButtons.forEach((button) => button.setAttribute("aria-pressed", "false"));
        update();
      });
      update();
    });
  };

  initializeSmartLinks();
  initializeIntakeSimulator();
})();
