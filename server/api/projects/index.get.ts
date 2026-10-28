import { Projects } from "~~/server/utils/projects";
import type { Project } from "~~/shared/types/task";

export default defineEventHandler((): Project[] => Projects.list());
