// API response contracts shared by the UI and the server.
//
// Record shapes are derived from the database row types with `import type`,
// which is erased at build time — no server code reaches the browser bundle.
// Services return `Wire<...>` values (Dates become ISO strings, exactly as JSON
// sends them), so a drift between the API and these types fails to compile.
import type * as db from "@/db/schema";

/** JSON wire form of a value: Date fields become ISO strings. */
export type Wire<T> = T extends Date
  ? string
  : T extends Array<infer U>
    ? Wire<U>[]
    : T extends object
      ? { [K in keyof T]: Wire<T[K]> }
      : T;

type Row<T extends { $inferSelect: unknown }> = Wire<T["$inferSelect"]>;

interface CustomerRef {
  customerName: string | null;
  customerEmail: string | null;
  customerAddress: string | null;
}

interface AssigneeRef {
  assigneeName: string | null;
  assigneeJobTitle: string | null;
  assigneeAvatarColor: string | null;
}

interface Commentable {
  commentCount: number;
}

export type CorrectiveItem = Row<typeof db.correctiveMaintenances> &
  CustomerRef &
  AssigneeRef &
  Commentable & { partnerName: string | null; productName: string | null; serviceCode: string | null };

export type PreventiveItem = Row<typeof db.preventiveMaintenances> &
  CustomerRef &
  AssigneeRef &
  Commentable & { productName: string | null; serviceCode: string | null };

export type ImplementationItem = Row<typeof db.implementations> &
  CustomerRef &
  AssigneeRef &
  Commentable & { partnerName: string | null; productName: string | null; serviceCode: string | null };

export type PocItem = Row<typeof db.pocRecords> &
  CustomerRef &
  AssigneeRef &
  Commentable & { partnerName: string | null; productName: string | null };

export type PipelineItem = Row<typeof db.pipelineDeals> &
  CustomerRef &
  AssigneeRef &
  Commentable & { partnerName: string | null; productName: string | null };

export type ChecklistItem = PreventiveItem["checklist"][number];
export type MilestoneItem = ImplementationItem["milestones"][number];

export type CustomerRecord = Row<typeof db.customers>;
export type PartnerRecord = Row<typeof db.businessPartners>;
export type ServiceRecord = Row<typeof db.serviceNumbers>;
export type ProductRecord = Row<typeof db.products>;
export type EventRecord = Row<typeof db.events>;
export type AlertLogRecord = Row<typeof db.emailAlertLogs>;
export type RoleRecord = Row<typeof db.roles>;
/** User as exposed by the API — never includes the password hash. */
export type UserRecord = Omit<Row<typeof db.users>, "passwordHash">;

/** Standard list envelope used by collection endpoints. */
export interface ListResponse<T> {
  items: T[];
}
export interface ItemResponse<T> {
  item: T;
}
export interface ApiErrorBody {
  error: string;
  details?: unknown;
}

export type CustomerItem = CustomerRecord &
  Commentable & {
    managerName: string | null;
    managerJobTitle: string | null;
    managerAvatarColor: string | null;
    serviceCount: number;
  };

export type PartnerItem = PartnerRecord;

export type ServiceItem = ServiceRecord & {
  customerName: string | null;
  customerEmail: string | null;
  partnerName: string | null;
  productName: string | null;
  picName: string | null;
  picAvatarColor: string | null;
};

export type ProductItem = ProductRecord & { partnerName: string | null; activeDeployments: number };

export type EventItem = EventRecord & { createdByName: string | null };
export interface EventsResponse {
  items: EventItem[];
  logs: AlertLogRecord[];
}

export type TeamMember = Pick<
  UserRecord,
  "id" | "name" | "email" | "jobTitle" | "department" | "phone" | "avatarColor" | "availability" | "isActive" | "roleId" | "lastLoginAt" | "createdAt"
> & { roleName: string; roleSlug: string };

export type RoleItem = RoleRecord & { memberCount: number };
export interface PermissionDefinition {
  key: string;
  module: string;
  label: string;
}
export interface RolesResponse {
  items: RoleItem[];
  availablePermissions: readonly PermissionDefinition[];
}

export interface CommentItem {
  id: number;
  entityType: string;
  entityId: number;
  body: string;
  createdAt: string;
  authorId: number | null;
  authorName: string | null;
  authorJobTitle: string | null;
  authorAvatarColor: string | null;
}

/** Dropdown data + sidebar badge counts loaded once per session. */
export interface LookupsData {
  customers: Array<{ id: number; name: string; code: string }>;
  partners: Array<{ id: number; name: string; code: string }>;
  products: Array<{ id: number; name: string; sku: string }>;
  services: Array<{ id: number; serviceNumber: string; title: string; customerId: number }>;
  users: Array<{ id: number; name: string; email: string; jobTitle: string; avatarColor: string; availability: string; isActive: boolean }>;
  roles: Array<{ id: number; name: string; slug: string }>;
  badges: { corrective: number; preventive: number; pipeline: number; events: number };
}

export type ActivityItem = Wire<(typeof db.activities)["$inferSelect"]> & { actorName: string | null };

export type AttachmentItem = Omit<
  Wire<(typeof db.attachments)["$inferSelect"]>,
  "content" | "driveFileId"
> & { uploadedByName: string | null };

export interface ExchangeRateInfo {
  /** Rupiah per 1 USD (BI middle rate when official). */
  rate: number;
  buy: number | null;
  sell: number | null;
  date: string;
  source: string;
  official: boolean;
}
