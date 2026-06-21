import { t } from "./i18n.js";

const UPDATE_TOAST_ID = "pwaUpdateToast";

if (canUseServiceWorker()) {
  registerServiceWorker();
}

function canUseServiceWorker() {
  return (
    "serviceWorker" in navigator &&
    window.location.protocol !== "file:" &&
    window.isSecureContext
  );
}

async function registerServiceWorker() {
  try {
    const registration = await navigator.serviceWorker.register("./sw.js");
    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      if (!worker) return;
      worker.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) {
          showUpdateToast(worker);
        }
      });
    });
  } catch (error) {
    console.warn("PWA registration skipped:", error);
  }
}

function showUpdateToast(worker) {
  if (document.getElementById(UPDATE_TOAST_ID)) return;
  const toast = document.createElement("button");
  toast.id = UPDATE_TOAST_ID;
  toast.className = "pwa-update-toast";
  toast.type = "button";
  toast.textContent = t("pwaUpdateToast");
  toast.addEventListener("click", () => {
    toast.disabled = true;
    worker.postMessage({ type: "SKIP_WAITING" });
  });
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    window.location.reload();
  }, { once: true });
  document.body.append(toast);
}
