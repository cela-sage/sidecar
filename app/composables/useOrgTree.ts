import { createSharedComposable } from "@vueuse/core";
import type { ComputedRef } from "vue";
import type { OrgTree } from "~/utils/org";

export const useOrgTree = createSharedComposable((): ComputedRef<OrgTree> => {
  const sc = useSidecar();
  const task = $task();
  const desk = $desk();
  const busy = $busy();
  const seen = $seen();
  const raised = $raised();
  return computed(() =>
    Org.treeOf({
      sessions: sc.sessions.value,
      tasks: Tasks.of(sc.catalogue.value),
      projects: task.projects,
      asking: desk.asks.flatMap((ask) => (ask.kind === "escalation" && ask.from ? [ask.from] : [])),
      busy: busy.keys,
      unseen: Object.keys(seen.keys),
      raised: raised.slugs,
    }),
  );
});
