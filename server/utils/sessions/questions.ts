import * as Events from "../../../lib/sidecar/events.ts";
import type { QuestionChanged } from "../../../shared/types/events.ts";
import type { Question } from "../../../shared/types/question.ts";
import { TurnBus } from "./busy.ts";

export type QuestionAnswers = Record<string, string>;

export interface AskedQuestion {
  key: string;
  ref: string;
  questions: Question[];
}

export interface WaitOptions {
  holdMs?: number;
  signal?: AbortSignal;
}

type Waiter = (answers?: QuestionAnswers) => void;

interface Held {
  answers: QuestionAnswers;
  take: () => void;
}

const HOLD_MS = 20_000;
// The hook polls again the moment a hold ends, so an answer that lands between two polls waits this long for the next.
const GRACE_MS = 2_000;

const asked = new Map<string, AskedQuestion>();
const waiters = new Map<string, Waiter>();
const held = new Map<string, Held>();

const publish = (data: QuestionChanged): void => Events.publish({ topic: "question.changed", key: data.key, data });

// A tool call reaches the transcript only once it is answered, so an open question is known from the mod alone.
const ask = (question: AskedQuestion): void => {
  asked.set(question.ref, question);
  publish(question);
  TurnBus.ask(question.key, true);
};

const release = (ref: string): void => {
  waiters.get(ref)?.();
};

const close = (ref: string): void => {
  release(ref);
  const question = asked.get(ref);
  if (!question) return;
  asked.delete(ref);
  publish({ key: question.key, ref });
  if (![...asked.values()].some((one) => one.key === question.key)) TurnBus.ask(question.key, false);
};

const open = (): AskedQuestion[] => [...asked.values()];

const wait = (ref: string, { holdMs = HOLD_MS, signal }: WaitOptions = {}): Promise<QuestionAnswers | undefined> =>
  new Promise((done) => {
    const kept = held.get(ref);
    if (kept) {
      held.delete(ref);
      kept.take();
      return done(kept.answers);
    }
    waiters.get(ref)?.();
    const finish: Waiter = (answers) => {
      clearTimeout(timer);
      if (waiters.get(ref) === finish) waiters.delete(ref);
      done(answers);
    };
    const timer = setTimeout(finish, holdMs);
    waiters.set(ref, finish);
    signal?.addEventListener("abort", () => finish(), { once: true });
  });

const give = (ref: string, answers: QuestionAnswers, graceMs = GRACE_MS): Promise<boolean> =>
  new Promise((done) => {
    const waiting = waiters.get(ref);
    if (waiting) {
      waiting(answers);
      return done(true);
    }
    const timer = setTimeout(() => {
      held.delete(ref);
      done(false);
    }, graceMs);
    held.set(ref, {
      answers,
      take: () => {
        clearTimeout(timer);
        done(true);
      },
    });
  });

export const OpenQuestions = { ask, close, give, open, release, wait };
