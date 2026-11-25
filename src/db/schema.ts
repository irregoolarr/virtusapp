import {
  bigint,
  customType,
  index,
  pgTable,
  serial,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";

/** Raw file bytes (used only when Google Drive storage is not configured). */
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

/** Rupiah amounts can exceed 2.1 billion, so money columns are bigint (JS number, exact up to 9e15). */
const rupiah = (name: string) => bigint(name, { mode: "number" }).notNull().default(0);

export interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

export interface MilestoneItem {
  id: string;
  title: string;
  completed: boolean;
}

export const roles = pgTable("roles", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 80 }).notNull().unique(),
  slug: varchar("slug", { length: 80 }).notNull().unique(),
  description: text("description").notNull().default(""),
  permissions: jsonb("permissions").$type<string[]>().notNull().default([]),
  isSystem: boolean("is_system").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  email: varchar("email", { length: 160 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  jobTitle: varchar("job_title", { length: 120 }).notNull(),
  department: varchar("department", { length: 100 }).notNull().default("Managed Services"),
  phone: varchar("phone", { length: 50 }),
  avatarColor: varchar("avatar_color", { length: 24 }).notNull().default("#18181A"),
  availability: varchar("availability", { length: 24 }).notNull().default("Online"),
  isActive: boolean("is_active").notNull().default(true),
  roleId: integer("role_id")
    .notNull()
    .references(() => roles.id),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  tokenHash: varchar("token_hash", { length: 128 }).notNull().unique(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 40 }).notNull().unique(),
  name: varchar("name", { length: 160 }).notNull(),
  industry: varchar("industry", { length: 100 }).notNull(),
  tier: varchar("tier", { length: 40 }).notNull().default("Enterprise"),
  status: varchar("status", { length: 40 }).notNull().default("Active"),
  contactName: varchar("contact_name", { length: 120 }).notNull(),
  contactEmail: varchar("contact_email", { length: 160 }).notNull(),
  contactPhone: varchar("contact_phone", { length: 50 }),
  address: text("address"),
  notes: text("notes"),
  managerId: integer("manager_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const businessPartners = pgTable("business_partners", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 40 }).notNull().unique(),
  name: varchar("name", { length: 160 }).notNull(),
  partnerType: varchar("partner_type", { length: 60 }).notNull(),
  tier: varchar("tier", { length: 40 }).notNull().default("Gold"),
  specialization: text("specialization").notNull(),
  contactName: varchar("contact_name", { length: 120 }).notNull(),
  contactEmail: varchar("contact_email", { length: 160 }).notNull(),
  contactPhone: varchar("contact_phone", { length: 50 }),
  escalationEmail: varchar("escalation_email", { length: 160 }),
  address: text("address"),
  status: varchar("status", { length: 32 }).notNull().default("Active"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  sku: varchar("sku", { length: 48 }).notNull().unique(),
  name: varchar("name", { length: 160 }).notNull(),
  category: varchar("category", { length: 80 }).notNull(),
  vendorName: varchar("vendor_name", { length: 120 }).notNull(),
  partnerId: integer("partner_id").references(() => businessPartners.id, { onDelete: "set null" }),
  description: text("description").notNull(),
  slaTargetHours: integer("sla_target_hours").notNull().default(4),
  pricingModel: varchar("pricing_model", { length: 80 }).notNull().default("Monthly Managed"),
  unitPriceIdr: rupiah("unit_price_idr"),
  status: varchar("status", { length: 32 }).notNull().default("Active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const serviceNumbers = pgTable("service_numbers", {
  id: serial("id").primaryKey(),
  serviceNumber: varchar("service_number", { length: 64 }).notNull().unique(),
  title: varchar("title", { length: 160 }).notNull(),
  category: varchar("category", { length: 80 }).notNull(),
  slaTier: varchar("sla_tier", { length: 60 }).notNull().default("24x7 Platinum"),
  status: varchar("status", { length: 40 }).notNull().default("Active"),
  monthlyFeeIdr: rupiah("monthly_fee_idr"),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  customerId: integer("customer_id")
    .notNull()
    .references(() => customers.id, { onDelete: "cascade" }),
  partnerId: integer("partner_id").references(() => businessPartners.id, { onDelete: "set null" }),
  productId: integer("product_id").references(() => products.id, { onDelete: "set null" }),
  picUserId: integer("pic_user_id").references(() => users.id, { onDelete: "set null" }),
  siteLocation: text("site_location"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const correctiveMaintenances = pgTable("corrective_maintenances", {
  id: serial("id").primaryKey(),
  ticketCode: varchar("ticket_code", { length: 40 }).notNull().unique(),
  title: varchar("title", { length: 180 }).notNull(),
  description: text("description").notNull(),
  severity: varchar("severity", { length: 24 }).notNull().default("High"),
  status: varchar("status", { length: 32 }).notNull().default("Reported"),
  rootCause: text("root_cause"),
  resolutionDetail: text("resolution_detail"),
  category: varchar("category", { length: 60 }).notNull().default("Other"),
  subcategory: varchar("subcategory", { length: 80 }).notNull().default("General"),
  source: varchar("source", { length: 40 }).notNull().default("Portal"),
  closedAt: timestamp("closed_at"),
  reopenCount: integer("reopen_count").notNull().default(0),
  escalatedAt: timestamp("escalated_at"),
  slaBreachNotifiedAt: timestamp("sla_breach_notified_at"),
  reportedAt: timestamp("reported_at").notNull().defaultNow(),
  dueDate: timestamp("due_date"),
  resolvedAt: timestamp("resolved_at"),
  customerId: integer("customer_id").references(() => customers.id, { onDelete: "set null" }),
  partnerId: integer("partner_id").references(() => businessPartners.id, { onDelete: "set null" }),
  serviceNumberId: integer("service_number_id").references(() => serviceNumbers.id, {
    onDelete: "set null",
  }),
  productId: integer("product_id").references(() => products.id, { onDelete: "set null" }),
  assigneeId: integer("assignee_id").references(() => users.id, { onDelete: "set null" }),
  attachmentCount: integer("attachment_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const preventiveMaintenances = pgTable("preventive_maintenances", {
  id: serial("id").primaryKey(),
  planCode: varchar("plan_code", { length: 40 }).notNull().unique(),
  title: varchar("title", { length: 180 }).notNull(),
  description: text("description").notNull(),
  frequency: varchar("frequency", { length: 32 }).notNull().default("Quarterly"),
  status: varchar("status", { length: 32 }).notNull().default("Scheduled"),
  category: varchar("category", { length: 60 }).notNull().default("Other"),
  subcategory: varchar("subcategory", { length: 80 }).notNull().default("General"),
  completionNotes: text("completion_notes"),
  reminderSentAt: timestamp("reminder_sent_at"),
  overdueNotifiedAt: timestamp("overdue_notified_at"),
  checklist: jsonb("checklist").$type<ChecklistItem[]>().notNull().default([]),
  scheduledDate: timestamp("scheduled_date").notNull(),
  lastCompletedAt: timestamp("last_completed_at"),
  customerId: integer("customer_id").references(() => customers.id, { onDelete: "set null" }),
  serviceNumberId: integer("service_number_id").references(() => serviceNumbers.id, {
    onDelete: "set null",
  }),
  productId: integer("product_id").references(() => products.id, { onDelete: "set null" }),
  assigneeId: integer("assignee_id").references(() => users.id, { onDelete: "set null" }),
  attachmentCount: integer("attachment_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const implementations = pgTable("implementations", {
  id: serial("id").primaryKey(),
  projectCode: varchar("project_code", { length: 40 }).notNull().unique(),
  title: varchar("title", { length: 180 }).notNull(),
  description: text("description").notNull(),
  status: varchar("status", { length: 32 }).notNull().default("Kickoff"),
  progressPct: integer("progress_pct").notNull().default(15),
  targetGoLive: timestamp("target_go_live"),
  projectType: varchar("project_type", { length: 60 }).notNull().default("Other"),
  goLiveAt: timestamp("go_live_at"),
  handoverNotes: text("handover_notes"),
  reminderSentAt: timestamp("reminder_sent_at"),
  overdueNotifiedAt: timestamp("overdue_notified_at"),
  milestones: jsonb("milestones").$type<MilestoneItem[]>().notNull().default([]),
  blockers: text("blockers"),
  customerId: integer("customer_id").references(() => customers.id, { onDelete: "set null" }),
  partnerId: integer("partner_id").references(() => businessPartners.id, { onDelete: "set null" }),
  serviceNumberId: integer("service_number_id").references(() => serviceNumbers.id, {
    onDelete: "set null",
  }),
  productId: integer("product_id").references(() => products.id, { onDelete: "set null" }),
  leadUserId: integer("lead_user_id").references(() => users.id, { onDelete: "set null" }),
  attachmentCount: integer("attachment_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const pocRecords = pgTable("poc_records", {
  id: serial("id").primaryKey(),
  pocCode: varchar("poc_code", { length: 40 }).notNull().unique(),
  title: varchar("title", { length: 180 }).notNull(),
  description: text("description").notNull(),
  status: varchar("status", { length: 32 }).notNull().default("Scoping"),
  outcome: varchar("outcome", { length: 32 }).notNull().default("Pending"),
  successCriteria: text("success_criteria").notNull(),
  evaluationScore: integer("evaluation_score").notNull().default(0),
  startDate: timestamp("start_date"),
  targetReviewDate: timestamp("target_review_date"),
  decisionNotes: text("decision_notes"),
  decidedAt: timestamp("decided_at"),
  extendedCount: integer("extended_count").notNull().default(0),
  reminderSentAt: timestamp("reminder_sent_at"),
  overdueNotifiedAt: timestamp("overdue_notified_at"),
  customerId: integer("customer_id").references(() => customers.id, { onDelete: "set null" }),
  partnerId: integer("partner_id").references(() => businessPartners.id, { onDelete: "set null" }),
  productId: integer("product_id").references(() => products.id, { onDelete: "set null" }),
  leadUserId: integer("lead_user_id").references(() => users.id, { onDelete: "set null" }),
  attachmentCount: integer("attachment_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const pipelineDeals = pgTable("pipeline_deals", {
  id: serial("id").primaryKey(),
  dealCode: varchar("deal_code", { length: 40 }).notNull().unique(),
  title: varchar("title", { length: 180 }).notNull(),
  description: text("description").notNull(),
  stage: varchar("stage", { length: 32 }).notNull().default("Contacted"),
  dealValueIdr: rupiah("deal_value_idr"),
  probabilityPct: integer("probability_pct").notNull().default(25),
  expectedCloseDate: timestamp("expected_close_date"),
  customerId: integer("customer_id").references(() => customers.id, { onDelete: "set null" }),
  partnerId: integer("partner_id").references(() => businessPartners.id, { onDelete: "set null" }),
  productId: integer("product_id").references(() => products.id, { onDelete: "set null" }),
  ownerId: integer("owner_id").references(() => users.id, { onDelete: "set null" }),
  attachmentCount: integer("attachment_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  eventCode: varchar("event_code", { length: 40 }).notNull().unique(),
  title: varchar("title", { length: 180 }).notNull(),
  description: text("description").notNull(),
  eventType: varchar("event_type", { length: 48 }).notNull().default("PM Reminder"),
  linkedModule: varchar("linked_module", { length: 40 }).notNull().default("general"),
  linkedRefCode: varchar("linked_ref_code", { length: 40 }),
  scheduledAt: timestamp("scheduled_at").notNull(),
  nextRunAt: timestamp("next_run_at").notNull(),
  recurrence: varchar("recurrence", { length: 24 }).notNull().default("Once"),
  reminderMinutesBefore: integer("reminder_minutes_before").notNull().default(60),
  recipientEmails: jsonb("recipient_emails").$type<string[]>().notNull().default([]),
  emailSubject: varchar("email_subject", { length: 200 }).notNull(),
  emailBody: text("email_body").notNull(),
  status: varchar("status", { length: 24 }).notNull().default("Scheduled"),
  lastSentAt: timestamp("last_sent_at"),
  createdById: integer("created_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const emailAlertLogs = pgTable("email_alert_logs", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").references(() => events.id, { onDelete: "set null" }),
  recipientEmails: jsonb("recipient_emails").$type<string[]>().notNull().default([]),
  subject: varchar("subject", { length: 220 }).notNull(),
  bodyPreview: text("body_preview").notNull(),
  deliveryMode: varchar("delivery_mode", { length: 32 }).notNull().default("sandbox_outbox"),
  status: varchar("status", { length: 24 }).notNull().default("Simulated"),
  messageId: varchar("message_id", { length: 180 }),
  errorMessage: text("error_message"),
  sentAt: timestamp("sent_at").notNull().defaultNow(),
});

export const entityComments = pgTable("entity_comments", {
  id: serial("id").primaryKey(),
  entityType: varchar("entity_type", { length: 32 }).notNull(),
  entityId: integer("entity_id").notNull(),
  authorId: integer("author_id").references(() => users.id, { onDelete: "set null" }),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const appSettings = pgTable("app_settings", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 80 }).notNull().unique(),
  value: jsonb("value").$type<Record<string, unknown>>().notNull().default({}),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/**
 * Timeline of a record: notes, outgoing emails, status / priority / assignment
 * changes and attachment uploads. System entries are kept for audit.
 */
export const activities = pgTable(
  "activities",
  {
    id: serial("id").primaryKey(),
    entityType: varchar("entity_type", { length: 32 }).notNull(),
    entityId: integer("entity_id").notNull(),
    type: varchar("type", { length: 24 }).notNull(), // Email | Note | Update | Attachment
    category: varchar("category", { length: 48 }).notNull(), // Outgoing Email | Status Change | ...
    subject: varchar("subject", { length: 300 }).notNull(),
    body: text("body").notNull().default(""),
    actorId: integer("actor_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("activities_entity_idx").on(t.entityType, t.entityId)]
);

/** Files attached to a record. Stored in Google Drive when configured, else in the database. */
export const attachments = pgTable(
  "attachments",
  {
    id: serial("id").primaryKey(),
    entityType: varchar("entity_type", { length: 32 }).notNull(),
    entityId: integer("entity_id").notNull(),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    mimeType: varchar("mime_type", { length: 150 }).notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    storage: varchar("storage", { length: 16 }).notNull(), // drive | database
    driveFileId: varchar("drive_file_id", { length: 128 }),
    driveLink: text("drive_link"),
    content: bytea("content"),
    uploadedById: integer("uploaded_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("attachments_entity_idx").on(t.entityType, t.entityId)]
);
