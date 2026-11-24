import { z } from "zod";
import { TRANSACTION_TYPES } from "./types";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const timestamp = z.string().min(10);

export const entryWriteSchema = z.object({
  id: z.string().uuid(),
  business_id: z.string().uuid(),
  type: z.enum(TRANSACTION_TYPES),
  amount: z.number().int().nonnegative(),
  currency: z.literal("UGX"),
  date: isoDate,
  description: z.string().trim().min(1).max(180),
  category: z.string().trim().min(1).max(40),
  counterparty: z.string().trim().max(120).nullable(),
  confidence: z.number().min(0).max(1),
  notes: z.string().max(240).nullable(),
  recorded_by: z.string().trim().max(80).nullable(),
  phone: z.string().max(20).nullable(),
  location: z.string().max(160).nullable(),
  due_date: isoDate.nullable(),
  agreed_amount: z.number().int().positive().nullable(),
  payment_method: z.enum(["cash", "mobile_money"]).nullable().optional(),
  unit_price: z.number().int().positive().nullable().optional(),
  source: z.enum(["ai", "demo", "sample"]),
  is_sample: z.boolean(),
  created_at: timestamp,
  updated_at: timestamp,
  deleted_at: timestamp.nullable(),
});

export const contactWriteSchema = z.object({
  id: z.string().uuid(),
  business_id: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  phone: z.string().max(20).nullable(),
  location: z.string().max(160).nullable(),
  kind: z.enum(["customer", "supplier"]),
  updated_at: timestamp,
  deleted_at: timestamp.nullable(),
});

export const staffWriteSchema = z.object({
  id: z.string().uuid(),
  business_id: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
  updated_at: timestamp,
  deleted_at: timestamp.nullable(),
});

export const goalWriteSchema = z.object({
  id: z.string().uuid(),
  business_id: z.string().uuid(),
  start_date: isoDate,
  end_date: isoDate,
  sell_at_least: z.number().int().positive().nullable(),
  spend_at_most: z.number().int().positive().nullable(),
  owe_less_than: z.number().int().positive().nullable(),
  pay_suppliers: z.number().int().positive().nullable(),
  updated_at: timestamp,
  deleted_at: timestamp.nullable(),
});

export const shopNameSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

export const magicLinkSchema = z.object({
  email: z.string().trim().email().max(200),
});
