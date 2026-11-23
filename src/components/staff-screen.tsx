"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStaff } from "@/lib/use-people";

export function StaffScreen() {
  const { staff, save } = useStaff();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  function addName() {
    const trimmed = name.trim().replace(/\s+/g, " ");
    if (!trimmed) {
      setError("Enter a name.");
      return;
    }
    if (staff.some((person) => person.toLowerCase() === trimmed.toLowerCase())) {
      setError("That name is already on the list.");
      return;
    }
    save([...staff, trimmed]);
    setName("");
    setError(null);
  }

  return (
    <div className="space-y-5">
      <div>
        <Link href="/ledger" className="text-sm font-semibold text-primary">
          Back to ledger
        </Link>
        <h1 className="mt-2 font-serif text-3xl tracking-tight">Staff</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          These names show up when you confirm a record. The list stays on this phone.
        </p>
      </div>
      <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
        {staff.map((person) => (
          <li key={person} className="flex items-center justify-between gap-3 px-3 py-3">
            <span className="font-semibold">{person}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive"
              disabled={staff.length === 1}
              onClick={() => save(staff.filter((item) => item !== person))}
            >
              Remove
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Input
          aria-label="New staff name"
          value={name}
          placeholder="Amina"
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") addName();
          }}
        />
        <Button type="button" onClick={addName}>
          Add
        </Button>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
