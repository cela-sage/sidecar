import type { Topics } from "~~/shared/types/events";

export const $raised = defineStore(() => {
  const counts = ref<Record<string, number>>({});

  const slugs = computed(() => Object.entries(counts.value).flatMap(([slug, raised]) => (raised ? [slug] : [])));

  const load = async (): Promise<void> => {
    const summary = await $fetch<Record<string, { raised: number }>>("/api/channels").catch(() => undefined);
    if (summary) counts.value = Object.fromEntries(Object.entries(summary).map(([slug, one]) => [slug, one.raised]));
  };

  const heard = ({ slug, raised }: Topics["channel.changed"]): void => {
    counts.value = { ...counts.value, [slug]: raised };
  };

  return { heard, load, slugs };
});
