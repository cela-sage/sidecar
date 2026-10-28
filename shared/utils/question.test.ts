import assert from "node:assert/strict";
import { test } from "node:test";
import { Questions } from "./question.ts";

test("a question reads from the tool's own input and from the sidecar's shape alike", () => {
  const tool = [
    {
      question: "Which flavours?",
      header: "Flavours",
      multiSelect: true,
      options: [{ label: "Mint", description: "Cool" }, { label: "Plum" }],
    },
  ];
  const expected = [
    {
      question: "Which flavours?",
      header: "Flavours",
      multi: true,
      options: [{ label: "Mint", description: "Cool" }, { label: "Plum" }],
    },
  ];
  assert.deepEqual(Questions.of(tool), expected);
  assert.deepEqual(Questions.of(expected), expected);
});

test("anything that is not a list of questions with text reads as none", () => {
  assert.equal(Questions.of(undefined), undefined);
  assert.equal(Questions.of([{ header: "No question" }]), undefined);
  assert.deepEqual(Questions.of([{ question: "Bare?", options: [{ description: "no label" }] }]), [
    { question: "Bare?", options: [] },
  ]);
});
