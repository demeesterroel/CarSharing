import { createResourceHooks } from "./use-resource";
import type { Person, PersonInput } from "@/types";

export const peopleHooks = createResourceHooks<Person, PersonInput>("people", "/api/people");
export const usePeople = peopleHooks.useList;
export const useCreatePerson = peopleHooks.useCreate;
export const useUpdatePerson = peopleHooks.useUpdate;
export const useDeletePerson = peopleHooks.useDelete;
