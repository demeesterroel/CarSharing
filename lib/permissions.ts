/**
 * Pure permission helpers shared by the backend (API route guards) and the
 * frontend (rendering edit forms read-only). This module has NO server
 * dependencies so it can be imported from client components.
 */

/** A record that can be edited/deleted: its author (`person_id`) and car (`car_id`). */
export interface EditableRecord {
  person_id: number;
  car_id: number;
}

/**
 * Pure function. Returns true if the person may edit/delete the given record.
 *
 * Allowed when the person is:
 * - an admin, or
 * - the author of the record (`record.person_id`), or
 * - the owner of the record's car (`carOwnerPersonId`, i.e. the car's
 *   `owner_person_id`).
 *
 * @param personId - The acting person's id.
 * @param isAdmin - Whether the acting person is an admin.
 * @param record - The record being edited (author + car).
 * @param carOwnerPersonId - The `owner_person_id` of the record's car, or null.
 */
export function canEdit(
  personId: number,
  isAdmin: boolean,
  record: EditableRecord,
  carOwnerPersonId: number | null
): boolean {
  if (isAdmin) return true;
  if (record.person_id === personId) return true;
  if (carOwnerPersonId !== null && carOwnerPersonId === personId) return true;
  return false;
}
