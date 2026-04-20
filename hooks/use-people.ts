import { createResourceHooks } from "./use-resource";
import type { Person } from "@/types";

const hooks = createResourceHooks<Person, Omit<Person, "id">>("people", "/api/people", {
  invalidate: [["dashboard"]],
});
export const usePeople = hooks.useList;
export const useCreatePerson = hooks.useCreate;
export const useUpdatePerson = hooks.useUpdate;
