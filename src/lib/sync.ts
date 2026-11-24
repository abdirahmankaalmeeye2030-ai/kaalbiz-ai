export interface SyncRecord {
  id: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface QueuedChange<T extends SyncRecord = SyncRecord> {
  table: string;
  record: T;
}

export function mergeRecords<T extends SyncRecord>(local: T[], remote: T[]): T[] {
  const byId = new Map<string, T>();
  for (const record of [...local, ...remote]) {
    const current = byId.get(record.id);
    if (!current || isNewer(record.updatedAt, current.updatedAt)) byId.set(record.id, record);
    else if (!isNewer(current.updatedAt, record.updatedAt) && record.deletedAt && !current.deletedAt) byId.set(record.id, record);
  }
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function isNewer(next: string, previous: string): boolean {
  const left = Date.parse(next);
  const right = Date.parse(previous);
  if (Number.isNaN(left) || Number.isNaN(right)) return next > previous;
  return left > right;
}

export function activeRecords<T extends SyncRecord>(records: T[]): T[] {
  return records.filter((record) => !record.deletedAt);
}

export function queueChange<T extends SyncRecord>(queue: QueuedChange<T>[], change: QueuedChange<T>): QueuedChange<T>[] {
  const rest = queue.filter((item) => !(item.table === change.table && item.record.id === change.record.id));
  return [...rest, change];
}

export function changesToPush<T extends SyncRecord>(shadow: T[], current: T[], table: string, now: string): QueuedChange<T>[] {
  const previous = new Map(shadow.map((record) => [record.id, record]));
  const seen = new Set<string>();
  const changes: QueuedChange<T>[] = [];
  for (const record of current) {
    seen.add(record.id);
    const before = previous.get(record.id);
    const comparable = { ...record, updatedAt: before?.updatedAt ?? record.updatedAt };
    const beforeComparable = before ? { ...before, updatedAt: before.updatedAt } : null;
    if (!before || JSON.stringify(beforeComparable) !== JSON.stringify(comparable)) {
      changes.push({ table, record: { ...record, updatedAt: now, deletedAt: record.deletedAt } });
    }
  }
  for (const before of shadow) {
    if (seen.has(before.id) || before.deletedAt) continue;
    changes.push({ table, record: { ...before, updatedAt: now, deletedAt: now } });
  }
  return changes;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isCloudId(id: string): boolean {
  return UUID.test(id);
}

export function migrateLocalRows<T extends { id: string; createdAt: string; updatedAt?: string | null; deletedAt?: string | null }>(
  rows: T[],
  table: string,
): QueuedChange<T & SyncRecord>[] {
  return rows.map((row) => ({
    table,
    record: {
      ...row,
      updatedAt: row.updatedAt || row.createdAt,
      deletedAt: row.deletedAt ?? null,
    },
  }));
}

export function applyRemote<T extends SyncRecord>(shadow: T[], remote: T[], queued: QueuedChange<T>[], table: string): T[] {
  const localPending = queued.filter((item) => item.table === table).map((item) => item.record);
  return mergeRecords(mergeRecords(shadow, remote), localPending);
}

export function syncPlan<T extends SyncRecord>(input: {
  shadow: T[];
  local: T[];
  remote: T[];
  now: string;
  forcePush?: boolean;
  clearRemote?: boolean;
}): { push: T[]; merged: T[] } {
  const pushed = new Map<string, T>();
  for (const change of changesToPush(input.shadow, input.local, "entries", input.now)) {
    pushed.set(change.record.id, change.record);
  }
  if (input.forcePush) {
    for (const row of input.local) {
      if (row.deletedAt) continue;
      pushed.set(row.id, { ...row, updatedAt: input.now, deletedAt: null });
    }
  }
  if (input.clearRemote) {
    for (const row of [...input.local, ...input.remote]) {
      if (row.deletedAt && !isNewer(input.now, row.updatedAt)) continue;
      pushed.set(row.id, { ...row, updatedAt: input.now, deletedAt: input.now });
    }
  }
  const push = [...pushed.values()].sort((a, b) => a.id.localeCompare(b.id));
  const stamped = mergeRecords(input.local, push);
  return { push, merged: mergeRecords(stamped, input.remote) };
}
