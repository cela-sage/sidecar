export function useTasksRedirect(slug?: string): void {
  const sc = useSidecar();
  const task = $task();

  loadSidecar();
  watch(
    () => sc.ready.value,
    (ready) => {
      if (ready) task.show({ ...(slug ? { slug } : {}), replace: true });
    },
    { immediate: true },
  );
}
