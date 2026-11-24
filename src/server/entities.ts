// Which permission guards each record type, and how to get its human code.
import { eq } from "drizzle-orm";
import {
  correctiveMaintenances,
  customers,
  db,
  implementations,
  pipelineDeals,
  pocRecords,
  preventiveMaintenances,
} from "@/db";
import type { PermissionKey } from "@/lib/rbac";
import { badRequest, notFound } from "./http";

export const ENTITY_TYPES = ["corrective", "preventive", "implementation", "poc", "pipeline", "customer"] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export const ENTITY_PERMISSIONS: Record<EntityType, { read: PermissionKey; write: PermissionKey; section: string }> = {
  corrective: { read: "maintenance:read", write: "maintenance:write", section: "Corrective Maintenance" },
  preventive: { read: "maintenance:read", write: "maintenance:write", section: "Preventive Maintenance" },
  implementation: { read: "delivery:read", write: "delivery:write", section: "Implementations" },
  poc: { read: "delivery:read", write: "delivery:write", section: "POC" },
  pipeline: { read: "pipeline:read", write: "pipeline:write", section: "Pipeline" },
  customer: { read: "customers:read", write: "customers:write", section: "Customers" },
};

export function parseEntityRef(type: unknown, id: unknown): { entityType: EntityType; entityId: number } {
  const entityId = Number(id);
  if (!ENTITY_TYPES.includes(type as EntityType) || !Number.isInteger(entityId) || entityId <= 0) {
    throw badRequest("Valid entityType and entityId are required");
  }
  return { entityType: type as EntityType, entityId };
}

/** Record code (CM-2026-001 etc.); throws 404 if the record does not exist. */
export async function recordCode(entityType: EntityType, entityId: number): Promise<string> {
  const lookups: Record<EntityType, () => Promise<Array<{ code: string }>>> = {
    corrective: () =>
      db.select({ code: correctiveMaintenances.ticketCode }).from(correctiveMaintenances).where(eq(correctiveMaintenances.id, entityId)),
    preventive: () =>
      db.select({ code: preventiveMaintenances.planCode }).from(preventiveMaintenances).where(eq(preventiveMaintenances.id, entityId)),
    implementation: () =>
      db.select({ code: implementations.projectCode }).from(implementations).where(eq(implementations.id, entityId)),
    poc: () => db.select({ code: pocRecords.pocCode }).from(pocRecords).where(eq(pocRecords.id, entityId)),
    pipeline: () => db.select({ code: pipelineDeals.dealCode }).from(pipelineDeals).where(eq(pipelineDeals.id, entityId)),
    customer: () => db.select({ code: customers.code }).from(customers).where(eq(customers.id, entityId)),
  };
  const [row] = await lookups[entityType]();
  if (!row) throw notFound();
  return row.code;
}
