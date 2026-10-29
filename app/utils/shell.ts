import type { ViewRect } from "~/types/frame";

export interface PopupOpen {
  id: number;
  opener: string;
  origin: string;
}

export interface SidecarShell {
  closePopup(id: number): void;
  isFullScreen: boolean;
  onFullScreen(cb: (full: boolean) => void): () => void;
  onPopupClosed(cb: (id: number) => void): () => void;
  onPopupOpen(cb: (open: PopupOpen) => void): () => void;
  openInChrome(url: string): void;
  partition: string;
  placeLights(rect: ViewRect): void;
  placePopup(id: number, rect: ViewRect): void;
  present: true;
}

export const sidecarShell = (): SidecarShell | undefined =>
  (window as unknown as { sidecarShell?: SidecarShell }).sidecarShell;
