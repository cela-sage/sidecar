import { Agent, type AgentRun } from "./agent";
import { fast } from "./fast";
import type {
  FastChatMessage,
  FastModelAnswer,
  FastModelEdit,
  FastModelReply,
  FastModelRequest,
  FastTask,
} from "../../../shared/types/models";

export const Models = {
  agent: Agent,
  fast,
};

export namespace Models {
  export type Run = AgentRun;
  export type Request = FastModelRequest;
  export type Reply = FastModelReply;
  export type Edit = FastModelEdit;
  export type Answer = FastModelAnswer;
  export type ChatMessage = FastChatMessage;
  export type Task = FastTask;
}
