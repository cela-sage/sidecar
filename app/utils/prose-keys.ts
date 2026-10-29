import type { InjectionKey } from "vue";

// Its own module, since prose.vue provides it and the parts prose.vue imports read it.
export const proseConversation: InjectionKey<string> = Symbol("prose-conversation");
