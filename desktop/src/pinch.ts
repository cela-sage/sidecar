import { ipcRenderer } from "electron";

// Read after dispatch, so a page that takes the pinch keeps it, and Electron's own pinch is off so nothing needs preventing.
export function sendPinches(): void {
  window.addEventListener(
    "wheel",
    (event) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      setTimeout(() => {
        if (!event.defaultPrevented) ipcRenderer.send("zoom:pinch", event.deltaY);
      });
    },
    { passive: true },
  );
}
