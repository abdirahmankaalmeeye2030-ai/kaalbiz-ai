import type { Contact } from "./people";
import { normalizeStaff, normalizeUgandaPhone } from "./people";

export const STAFF_KEY = "kaalbiz.staff.v1";
export const STAFF_EVENT = "kaalbiz:staff";
export const LAST_STAFF_KEY = "kaalbiz.staff.last";
export const CONTACTS_KEY = "kaalbiz.contacts.v1";
export const CONTACTS_EVENT = "kaalbiz:contacts";

export function parseStaff(raw: string | null): string[] {
  if (!raw) return ["Owner"];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return ["Owner"];
    return normalizeStaff(parsed.filter((item): item is string => typeof item === "string"));
  } catch {
    return ["Owner"];
  }
}

export function saveStaff(names: string[]): void {
  window.localStorage.setItem(STAFF_KEY, JSON.stringify(normalizeStaff(names)));
  window.dispatchEvent(new Event(STAFF_EVENT));
}

export function parseContacts(raw: string | null): Contact[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const contact = item as Partial<Contact>;
      const name = contact.name?.trim();
      if (!name) return [];
      return [
        {
          name,
          phone: contact.phone ? normalizeUgandaPhone(contact.phone) : null,
          location: contact.location?.trim() || null,
          kind: contact.kind === "supplier" ? "supplier" : "customer",
        },
      ];
    });
  } catch {
    return [];
  }
}

export function saveContacts(contacts: Contact[]): void {
  window.localStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts));
  window.dispatchEvent(new Event(CONTACTS_EVENT));
}

export function upsertContact(contact: Contact): void {
  const current = parseContacts(window.localStorage.getItem(CONTACTS_KEY));
  const next = current.filter((item) => item.name.toLowerCase() !== contact.name.toLowerCase() || item.kind !== contact.kind);
  next.push(contact);
  saveContacts(next);
}
