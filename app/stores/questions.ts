import type { QuestionChanged } from "~~/shared/types/events";
import type { Question } from "~~/shared/types/question";

export interface AskedQuestion {
  key: string;
  ref: string;
  questions: Question[];
  picks: Record<string, string>;
  isAnswering: boolean;
  isMissed: boolean;
}

const opened = ({ key, ref, questions }: Required<QuestionChanged>): AskedQuestion => ({
  key,
  ref,
  questions,
  picks: {},
  isAnswering: false,
  isMissed: false,
});

export const $questions = defineStore(() => {
  const open = ref<Record<string, AskedQuestion>>({});

  const openIn = (key?: string): AskedQuestion | undefined =>
    Object.values(open.value).findLast((one) => one.key === key);

  const hear = ({ key, ref, questions }: QuestionChanged): void => {
    if (questions) {
      open.value = { ...open.value, [ref]: open.value[ref] ?? opened({ key, ref, questions }) };
      return;
    }
    open.value = Object.fromEntries(Object.entries(open.value).filter(([one]) => one !== ref));
  };

  // A stream that dropped may have missed a settle, so what the server lists replaces what was held.
  const load = async (): Promise<void> => {
    const list = await $fetch<Required<QuestionChanged>[]>("/api/questions").catch(() => undefined);
    if (list) open.value = Object.fromEntries(list.map((one) => [one.ref, open.value[one.ref] ?? opened(one)]));
  };

  // Several questions go back as one answer, so a pick waits until every question has one.
  const pick = async ({ ref, question, answer }: { ref: string; question: string; answer: string }): Promise<void> => {
    const live = open.value[ref];
    if (!live || live.isAnswering) return;
    const picks = { ...live.picks, [question]: answer };
    live.picks = picks;
    live.isMissed = false;
    if (live.questions.some((one) => !picks[one.question])) return;
    live.isAnswering = true;
    const { taken } = await $fetch<{ taken: boolean }>(`/api/questions/${encodeURIComponent(ref)}/answer`, {
      body: { answers: picks },
      method: "POST",
    }).catch(() => ({ taken: false }));
    if (!taken) {
      live.isAnswering = false;
      live.isMissed = true;
    }
  };

  return { hear, load, open, openIn, pick };
});
