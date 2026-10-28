import type { Question, QuestionOption } from "../types/question.ts";

const textOf = (value: unknown): string | undefined => (typeof value === "string" && value ? value : undefined);

function optionOf(value: unknown): QuestionOption[] {
  if (typeof value !== "object" || !value || !("label" in value)) return [];
  const label = textOf(value.label);
  const description = "description" in value ? textOf(value.description) : undefined;
  return label ? [{ label, ...(description ? { description } : {}) }] : [];
}

// The tool's own input says multiSelect, the sidecar's turns say multi, and both read here.
function questionOf(value: unknown): Question[] {
  if (typeof value !== "object" || !value || !("question" in value)) return [];
  const question = textOf(value.question);
  if (!question) return [];
  const header = "header" in value ? textOf(value.header) : undefined;
  const options = "options" in value && Array.isArray(value.options) ? value.options.flatMap(optionOf) : [];
  const isMulti = ("multi" in value && value.multi === true) || ("multiSelect" in value && value.multiSelect === true);
  return [{ question, options, ...(header ? { header } : {}), ...(isMulti ? { multi: true as const } : {}) }];
}

const of = (value: unknown): Question[] | undefined => {
  const questions = Array.isArray(value) ? value.flatMap(questionOf) : [];
  return questions.length ? questions : undefined;
};

export const Questions = { of };
