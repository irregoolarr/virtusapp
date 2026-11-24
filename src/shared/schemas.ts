// Request-body schemas shared by the UI (types) and the API (validation).
import { z } from "zod";
import {
  AVAILABILITIES,
  COMMENT_ENTITY_TYPES,
  CORRECTIVE_STAGES,
  CUSTOMER_STATUSES,
  CUSTOMER_TIERS,
  EVENT_MODULES,
  EVENT_RECURRENCES,
  EVENT_STATUSES,
  EVENT_TYPES,
  IMPLEMENTATION_STAGES,
  PARTNER_STATUSES,
  PARTNER_TIERS,
  PARTNER_TYPES,
  PIPELINE_STAGES,
  PM_FREQUENCIES,
  POC_OUTCOMES,
  POC_STAGES,
  PREVENTIVE_STAGES,
  PRODUCT_STATUSES,
  SERVICE_STATUSES,
  SEVERITIES,
  SLA_TIERS,
} from "./constants";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(4),
});

export const correctiveCreateSchema = z.object({
  title: z.string().min(2).max(180),
  description: z.string().min(2),
  severity: z.enum(SEVERITIES).default("High"),
  status: z.enum(CORRECTIVE_STAGES).default("Reported"),
  rootCause: z.string().optional().nullable(),
  resolutionNotes: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  customerId: z.number().int().positive().optional().nullable(),
  partnerId: z.number().int().positive().optional().nullable(),
  serviceNumberId: z.number().int().positive().optional().nullable(),
  productId: z.number().int().positive().optional().nullable(),
  assigneeId: z.number().int().positive().optional().nullable(),
});

export const preventiveCreateSchema = z.object({
  title: z.string().min(2).max(180),
  description: z.string().min(2),
  frequency: z.enum(PM_FREQUENCIES).default("Quarterly"),
  status: z.enum(PREVENTIVE_STAGES).default("Scheduled"),
  scheduledDate: z.string(),
  checklist: z
    .array(z.object({ id: z.string(), label: z.string(), done: z.boolean() }))
    .default([]),
  customerId: z.number().int().positive().optional().nullable(),
  serviceNumberId: z.number().int().positive().optional().nullable(),
  productId: z.number().int().positive().optional().nullable(),
  assigneeId: z.number().int().positive().optional().nullable(),
});

export const implementationCreateSchema = z.object({
  title: z.string().min(2).max(180),
  description: z.string().min(2),
  status: z.enum(IMPLEMENTATION_STAGES).default("Kickoff"),
  progressPct: z.number().int().min(0).max(100).default(20),
  targetGoLive: z.string().optional().nullable(),
  blockers: z.string().optional().nullable(),
  milestones: z
    .array(z.object({ id: z.string(), title: z.string(), completed: z.boolean() }))
    .default([]),
  customerId: z.number().int().positive().optional().nullable(),
  partnerId: z.number().int().positive().optional().nullable(),
  serviceNumberId: z.number().int().positive().optional().nullable(),
  productId: z.number().int().positive().optional().nullable(),
  leadUserId: z.number().int().positive().optional().nullable(),
});

export const pocCreateSchema = z.object({
  title: z.string().min(2).max(180),
  description: z.string().min(2),
  status: z.enum(POC_STAGES).default("Scoping"),
  outcome: z.enum(POC_OUTCOMES).default("Pending"),
  successCriteria: z.string().min(2),
  evaluationScore: z.number().int().min(0).max(100).default(0),
  startDate: z.string().optional().nullable(),
  targetReviewDate: z.string().optional().nullable(),
  customerId: z.number().int().positive().optional().nullable(),
  partnerId: z.number().int().positive().optional().nullable(),
  productId: z.number().int().positive().optional().nullable(),
  leadUserId: z.number().int().positive().optional().nullable(),
});

export const pipelineCreateSchema = z.object({
  title: z.string().min(2).max(180),
  description: z.string().min(2),
  stage: z.enum(PIPELINE_STAGES).default("Contacted"),
  dealValueUsd: z.number().int().min(0).default(0),
  probabilityPct: z.number().int().min(0).max(100).default(30),
  expectedCloseDate: z.string().optional().nullable(),
  customerId: z.number().int().positive().optional().nullable(),
  partnerId: z.number().int().positive().optional().nullable(),
  productId: z.number().int().positive().optional().nullable(),
  ownerId: z.number().int().positive().optional().nullable(),
});

export const customerCreateSchema = z.object({
  name: z.string().min(2).max(160),
  industry: z.string().min(2).max(100),
  tier: z.enum(CUSTOMER_TIERS).default("Enterprise"),
  status: z.enum(CUSTOMER_STATUSES).default("Active"),
  contactName: z.string().min(2).max(120),
  contactEmail: z.string().email(),
  contactPhone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  managerId: z.number().int().positive().optional().nullable(),
});

export const partnerCreateSchema = z.object({
  name: z.string().min(2).max(160),
  partnerType: z.enum(PARTNER_TYPES)
    .default("Vendor / Principal"),
  tier: z.enum(PARTNER_TIERS).default("Gold"),
  specialization: z.string().min(2),
  contactName: z.string().min(2).max(120),
  contactEmail: z.string().email(),
  contactPhone: z.string().optional().nullable(),
  escalationEmail: z.string().email().optional().nullable().or(z.literal("")),
  address: z.string().optional().nullable(),
  status: z.enum(PARTNER_STATUSES).default("Active"),
  notes: z.string().optional().nullable(),
});

export const serviceCreateSchema = z.object({
  serviceNumber: z.string().min(3).max(64),
  title: z.string().min(2).max(160),
  category: z.string().min(2).max(80),
  slaTier: z.enum(SLA_TIERS).default("24x7 Platinum"),
  status: z.enum(SERVICE_STATUSES).default("Active"),
  monthlyFeeUsd: z.number().int().min(0).default(0),
  startDate: z.string(),
  endDate: z.string(),
  customerId: z.number().int().positive(),
  partnerId: z.number().int().positive().optional().nullable(),
  productId: z.number().int().positive().optional().nullable(),
  picUserId: z.number().int().positive().optional().nullable(),
  siteLocation: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const productCreateSchema = z.object({
  sku: z.string().min(2).max(48),
  name: z.string().min(2).max(160),
  category: z.string().min(2).max(80),
  vendorName: z.string().min(2).max(120),
  partnerId: z.number().int().positive().optional().nullable(),
  description: z.string().min(2),
  slaTargetHours: z.number().int().min(1).default(4),
  pricingModel: z.string().min(2).max(80).default("Monthly Managed"),
  unitPriceUsd: z.number().int().min(0).default(0),
  status: z.enum(PRODUCT_STATUSES).default("Active"),
});

export const eventCreateSchema = z.object({
  title: z.string().min(2).max(180),
  description: z.string().min(2),
  eventType: z.enum(EVENT_TYPES)
    .default("PM Reminder"),
  linkedModule: z.enum(EVENT_MODULES)
    .default("general"),
  linkedRefCode: z.string().optional().nullable(),
  scheduledAt: z.string(),
  recurrence: z.enum(EVENT_RECURRENCES).default("Once"),
  reminderMinutesBefore: z.number().int().min(0).default(60),
  recipientEmails: z.array(z.string().email()).min(1),
  emailSubject: z.string().min(2).max(200),
  emailBody: z.string().min(2),
  status: z.enum(EVENT_STATUSES).default("Scheduled"),
});

export const userCreateSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(6),
  jobTitle: z.string().min(2).max(120),
  department: z.string().min(2).max(100).default("Managed Services"),
  phone: z.string().optional().nullable(),
  avatarColor: z.string().default("#18181A"),
  availability: z.enum(AVAILABILITIES).default("Online"),
  isActive: z.boolean().default(true),
  roleId: z.number().int().positive(),
});

export const roleCreateSchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().default(""),
  permissions: z.array(z.string()).default([]),
});

export const userUpdateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  jobTitle: z.string().min(2).max(120).optional(),
  department: z.string().min(2).max(100).optional(),
  phone: z.string().optional().nullable(),
  availability: z.enum(AVAILABILITIES).optional(),
  isActive: z.boolean().optional(),
  roleId: z.number().int().positive().optional(),
  password: z.string().min(6).optional(),
});

export const commentCreateSchema = z.object({
  entityType: z.enum(COMMENT_ENTITY_TYPES),
  entityId: z.number().int().positive(),
  body: z.string().min(1).max(2000),
});

export const settingsUpdateSchema = z.object({
  smtp: z
    .object({
      host: z.string(),
      port: z.number().int().min(1).max(65535),
      secure: z.boolean(),
      user: z.string(),
      pass: z.string().optional(),
      from: z.string(),
      defaultAlertEmail: z.string().email(),
    })
    .optional(),
  ops: z
    .object({
      companyName: z.string().min(2),
      defaultSlaWarningDays: z.number().int().min(1).max(365),
      autoEscalateCriticalMinutes: z.number().int().min(5).max(1440),
      currencySymbol: z.string().min(1).max(4),
    })
    .optional(),
});

export const reportEmailSchema = z.object({
  recipients: z.array(z.string().email()).min(1),
  subject: z.string().min(2).max(200).optional(),
});

// Profile (self-service)
export const profileNameSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(60),
  lastName: z.string().trim().max(60).default(""),
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters").max(200),
});

export type CorrectiveInput = z.input<typeof correctiveCreateSchema>;
export type PreventiveInput = z.input<typeof preventiveCreateSchema>;
export type ImplementationInput = z.input<typeof implementationCreateSchema>;
export type PocInput = z.input<typeof pocCreateSchema>;
export type PipelineInput = z.input<typeof pipelineCreateSchema>;
export type CustomerInput = z.input<typeof customerCreateSchema>;
export type PartnerInput = z.input<typeof partnerCreateSchema>;
export type ServiceInput = z.input<typeof serviceCreateSchema>;
export type ProductInput = z.input<typeof productCreateSchema>;
export type EventInput = z.input<typeof eventCreateSchema>;
export type UserInput = z.input<typeof userCreateSchema>;
export type RoleInput = z.input<typeof roleCreateSchema>;
