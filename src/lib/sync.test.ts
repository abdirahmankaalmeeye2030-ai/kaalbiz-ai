import { describe, expect, it } from "vitest";
import { entryWriteSchema, magicLinkSchema } from "./cloud-schema";
import { activeRecords, applyRemote, changesToPush, isCloudId, mergeRecords, migrateLocalRows, queueChange, syncPlan, type SyncRecord } from "./sync";

interface Row extends SyncRecord {
  name: string;
}

function row(id: string, name: string, updatedAt: string, deletedAt: string | null = null): Row {
  return { id, name, updatedAt, deletedAt };
}

describe("sync merge and queue", () => {
  it("keeps the later updated_at and drops the loser", () => {
    const merged = mergeRecords(
      [row("a", "local", "2026-11-24T10:00:00.000Z")],
      [row("a", "remote", "2026-11-24T11:00:00.000Z"), row("b", "only remote", "2026-11-24T09:00:00.000Z")],
    );
    expect(merged.find((item) => item.id === "a")?.name).toBe("remote");
    expect(merged.find((item) => item.id === "b")?.name).toBe("only remote");
  });

  it("hides soft-deleted rows from the working list but keeps them for sync", () => {
    const merged = mergeRecords(
      [row("a", "gone", "2026-11-24T12:00:00.000Z", "2026-11-24T12:00:00.000Z")],
      [row("a", "old", "2026-11-24T09:00:00.000Z")],
    );
    expect(activeRecords(merged)).toEqual([]);
    expect(merged).toHaveLength(1);
  });

  it("queues an edit and a delete, replacing an older queued edit", () => {
    const first = queueChange([], { table: "entries", record: row("a", "one", "2026-11-24T10:00:00.000Z") });
    const second = queueChange(first, { table: "entries", record: row("a", "two", "2026-11-24T11:00:00.000Z") });
    expect(second).toHaveLength(1);
    expect(second[0]?.record.name).toBe("two");
  });

  it("builds a push list from the last shadow and applies the remote copy", () => {
    const shadow = [row("a", "old", "2026-11-24T08:00:00.000Z")];
    const current = [row("a", "edited", "2026-11-24T08:00:00.000Z"), row("b", "new", "2026-11-24T08:00:00.000Z")];
    const changes = changesToPush(shadow, current, "entries", "2026-11-24T12:00:00.000Z");
    expect(changes.map((change) => change.record.id).sort()).toEqual(["a", "b"]);
    expect(changes.every((change) => change.record.updatedAt === "2026-11-24T12:00:00.000Z")).toBe(true);

    const removed = changesToPush(current, [current[0]!], "entries", "2026-11-24T13:00:00.000Z");
    expect(removed.find((change) => change.record.id === "b")?.record.deletedAt).toBe("2026-11-24T13:00:00.000Z");

    const applied = applyRemote(shadow, [row("a", "from cloud", "2026-11-24T15:00:00.000Z")], [], "entries");
    expect(activeRecords(applied).find((item) => item.id === "a")?.name).toBe("from cloud");
  });

  it("does not resurrect a deleted sale when the cloud still has the old copy", () => {
    const sale = row("sale", "Sale", "2026-11-24T10:00:00.000Z");
    const debt = row("debt", "Money owed to me", "2026-11-24T10:00:00.000Z");
    const first = syncPlan({
      shadow: [sale, debt],
      local: [debt],
      remote: [sale, debt],
      now: "2026-11-24T12:00:00.000Z",
    });
    expect(first.push.find((item) => item.id === "sale")?.deletedAt).toBe("2026-11-24T12:00:00.000Z");
    expect(activeRecords(first.merged).map((item) => item.id)).toEqual(["debt"]);

    const cloudStillStale = [sale, debt];
    const second = syncPlan({
      shadow: first.merged,
      local: first.merged,
      remote: cloudStillStale,
      now: "2026-11-24T12:00:01.000Z",
    });
    expect(second.push).toEqual([]);
    expect(activeRecords(second.merged).map((item) => item.id)).toEqual(["debt"]);
  });

  it("keeps a new local row and pushes it before an older cloud list can replace it", () => {
    const sale = row("sale", "Sale", "2026-11-24T10:00:00.000Z");
    const created = row("new", "New sale", "2026-11-24T10:00:00.000Z");
    const planned = syncPlan({
      shadow: [sale],
      local: [sale, created],
      remote: [sale],
      now: "2026-11-24T12:00:00.000Z",
    });
    expect(planned.push.map((item) => item.id)).toEqual(["new"]);
    expect(activeRecords(planned.merged).map((item) => item.id).sort()).toEqual(["new", "sale"]);
  });

  it("clear all tombstones the phone and the older cloud copies", () => {
    const sale = row("sale", "Sale", "2026-11-24T10:00:00.000Z");
    const debt = row("debt", "Money owed to me", "2026-11-24T09:00:00.000Z");
    const planned = syncPlan({
      shadow: [sale],
      local: [{ ...sale, updatedAt: "2026-11-24T12:00:00.000Z", deletedAt: "2026-11-24T12:00:00.000Z" }],
      remote: [sale, debt],
      now: "2026-11-24T12:00:00.000Z",
      clearRemote: true,
    });
    expect(activeRecords(planned.merged)).toEqual([]);
    expect(planned.push.map((item) => item.id).sort()).toEqual(["debt", "sale"]);
    expect(planned.push.every((item) => item.deletedAt === "2026-11-24T12:00:00.000Z")).toBe(true);
  });

  it("compares instants, so an offset clock cannot look older than it is", () => {
    const merged = mergeRecords(
      [row("a", "local", "2026-11-24T14:00:00.000Z")],
      [row("a", "remote", "2026-11-24T12:00:00-03:00")],
    );
    expect(merged.find((item) => item.id === "a")?.name).toBe("remote");
  });
});

describe("local record migration", () => {
  it("turns phone records into a cloud queue without dropping the original time", () => {
    const queued = migrateLocalRows(
      [
        {
          id: "8d8b6c1e-4b1a-4e2a-9c1a-0b1c2d3e4f50",
          createdAt: "2026-11-20T08:00:00.000Z",
          description: "Rice",
          amount: 20000,
        },
      ],
      "entries",
    );
    expect(queued).toHaveLength(1);
    expect(queued[0]?.table).toBe("entries");
    expect(queued[0]?.record.updatedAt).toBe("2026-11-20T08:00:00.000Z");
    expect(queued[0]?.record.deletedAt).toBeNull();
    expect(queued[0]?.record.amount).toBe(20000);
  });
});

describe("cloud ids", () => {
  it("accepts a real record id and skips a sample id", () => {
    expect(isCloudId("8d8b6c1e-4b1a-4e2a-9c1a-0b1c2d3e4f50")).toBe(true);
    expect(isCloudId("sample-sugar")).toBe(false);
  });
});

describe("cloud write schema", () => {
  it("accepts a ledger row and rejects a negative amount or bad email", () => {
    const parsed = entryWriteSchema.parse({
      id: "8d8b6c1e-4b1a-4e2a-9c1a-0b1c2d3e4f50",
      business_id: "8d8b6c1e-4b1a-4e2a-9c1a-0b1c2d3e4f51",
      type: "sale",
      amount: 20000,
      currency: "UGX",
      date: "2026-11-24",
      description: "Rice",
      category: "Food",
      counterparty: null,
      confidence: 0.8,
      notes: null,
      recorded_by: "Amina",
      phone: null,
      location: null,
      due_date: null,
      agreed_amount: null,
      source: "demo",
      is_sample: false,
      created_at: "2026-11-24T08:00:00.000Z",
      updated_at: "2026-11-24T08:00:00.000Z",
      deleted_at: null,
    });
    expect(parsed.amount).toBe(20000);
    expect(() => entryWriteSchema.parse({ ...parsed, amount: -1 })).toThrow();
    expect(magicLinkSchema.safeParse({ email: "owner@shop.test" }).success).toBe(true);
    expect(magicLinkSchema.safeParse({ email: "not-an-email" }).success).toBe(false);
  });
});
