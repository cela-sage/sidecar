export interface FileMenuAsk {
  path: string;
  x: number;
  y: number;
}

export const $fileMenu = defineStore(() => {
  const asked = shallowRef<FileMenuAsk>();

  const openFor = (event: MouseEvent, path: string): void => {
    asked.value = { path, x: event.clientX, y: event.clientY };
  };

  return { asked, openFor };
});
