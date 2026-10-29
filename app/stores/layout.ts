export const $layout = defineStore(() => {
  const width = ref(1440);

  const sideCap = computed(() => {
    if (width.value < 1100) return 264;
    if (width.value < 1280) return 296;
    return undefined;
  });
  const listCap = computed(() => (width.value < 1200 ? 232 : undefined));
  const hasCounts = computed(() => width.value >= 1320);
  const isFolded = computed(() => width.value < 1100);

  return { hasCounts, isFolded, listCap, sideCap, width };
});
