export function shortNameOf(person: {
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
}): string {
  if (person.first_name) return person.first_name;
  if (person.username) {
    const u = person.username;
    return u.charAt(0).toUpperCase() + u.slice(1);
  }
  return "?";
}

export function fullNameOf(person: {
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
}): string {
  const short = shortNameOf(person);
  const last = person.last_name?.trim();
  return last ? `${short} ${last.toUpperCase()}` : short;
}

/** @deprecated Use shortNameOf instead */
export function firstNameOf(person: { first_name?: string | null; name: string }): string {
  return person.first_name || person.name.split(" ")[0] || person.name;
}
