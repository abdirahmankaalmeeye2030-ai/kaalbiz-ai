"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  CONTACTS_EVENT,
  CONTACTS_KEY,
  LAST_STAFF_KEY,
  STAFF_EVENT,
  STAFF_KEY,
  parseContacts,
  parseStaff,
  saveContacts,
  saveStaff,
  upsertContact,
} from "./people-storage";
import type { Contact } from "./people";

function listen(eventName: string) {
  return (onChange: () => void) => {
    window.addEventListener("storage", onChange);
    window.addEventListener(eventName, onChange);
    return () => {
      window.removeEventListener("storage", onChange);
      window.removeEventListener(eventName, onChange);
    };
  };
}

export function useStaff() {
  const raw = useSyncExternalStore(listen(STAFF_EVENT), () => window.localStorage.getItem(STAFF_KEY) ?? "", () => "");
  const lastRaw = useSyncExternalStore(
    listen(STAFF_EVENT),
    () => window.localStorage.getItem(LAST_STAFF_KEY) ?? "",
    () => "",
  );
  const staff = useMemo(() => parseStaff(raw || null), [raw]);
  const lastUsed = staff.find((name) => name === lastRaw) ?? staff[0] ?? "Owner";
  const save = useCallback((names: string[]) => saveStaff(names), []);
  const remember = useCallback((name: string) => {
    window.localStorage.setItem(LAST_STAFF_KEY, name);
    window.dispatchEvent(new Event(STAFF_EVENT));
  }, []);
  return { staff, lastUsed, save, remember };
}

export function useContacts() {
  const raw = useSyncExternalStore(
    listen(CONTACTS_EVENT),
    () => window.localStorage.getItem(CONTACTS_KEY) ?? "",
    () => "",
  );
  const contacts = useMemo(() => parseContacts(raw || null), [raw]);
  const save = useCallback((next: Contact[]) => saveContacts(next), []);
  const upsert = useCallback((contact: Contact) => upsertContact(contact), []);
  return { contacts, save, upsert };
}
