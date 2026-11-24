import { asc, eq, sql } from "drizzle-orm";
import {
  businessPartners,
  correctiveMaintenances,
  customers,
  db,
  events,
  pipelineDeals,
  preventiveMaintenances,
  products,
  roles,
  serviceNumbers,
  users,
} from "@/db";
import type { LookupsData } from "@/shared/types";

const count = sql<number>`count(*)::int`;

export async function getLookups(): Promise<LookupsData> {
  const [customerRows, partnerRows, productRows, serviceRows, userRows, roleRows, cmOpen, pmOpen, dealOpen, evtScheduled] =
    await Promise.all([
      db.select({ id: customers.id, name: customers.name, code: customers.code }).from(customers).orderBy(asc(customers.name)),
      db
        .select({ id: businessPartners.id, name: businessPartners.name, code: businessPartners.code })
        .from(businessPartners)
        .orderBy(asc(businessPartners.name)),
      db.select({ id: products.id, name: products.name, sku: products.sku }).from(products).orderBy(asc(products.name)),
      db
        .select({
          id: serviceNumbers.id,
          serviceNumber: serviceNumbers.serviceNumber,
          title: serviceNumbers.title,
          customerId: serviceNumbers.customerId,
        })
        .from(serviceNumbers)
        .orderBy(asc(serviceNumbers.serviceNumber)),
      db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          jobTitle: users.jobTitle,
          avatarColor: users.avatarColor,
          availability: users.availability,
          isActive: users.isActive,
        })
        .from(users)
        .where(eq(users.isActive, true))
        .orderBy(asc(users.name)),
      db.select({ id: roles.id, name: roles.name, slug: roles.slug }).from(roles).orderBy(asc(roles.id)),
      db.select({ count }).from(correctiveMaintenances).where(sql`${correctiveMaintenances.status} NOT IN ('Resolved', 'Closed')`),
      db.select({ count }).from(preventiveMaintenances).where(sql`${preventiveMaintenances.status} != 'Completed'`),
      db.select({ count }).from(pipelineDeals).where(sql`${pipelineDeals.stage} != 'Deal Closed'`),
      db.select({ count }).from(events).where(eq(events.status, "Scheduled")),
    ]);

  return {
    customers: customerRows,
    partners: partnerRows,
    products: productRows,
    services: serviceRows,
    users: userRows,
    roles: roleRows,
    badges: {
      corrective: cmOpen[0]?.count ?? 0,
      preventive: pmOpen[0]?.count ?? 0,
      pipeline: dealOpen[0]?.count ?? 0,
      events: evtScheduled[0]?.count ?? 0,
    },
  };
}
