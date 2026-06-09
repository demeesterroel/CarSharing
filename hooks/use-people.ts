import type { Person } from "@/types";
import { createResourceHooks } from "./use-resource";

const hooks = createResourceHooks<Person, Omit<Person, "id">>("people", "/api/people", {
  invalidate: [["dashboard"]],
});
export const usePeople = hooks.useList;
export const useCreatePerson = hooks.useCreate;
export const useUpdatePerson = hooks.useUpdate;
