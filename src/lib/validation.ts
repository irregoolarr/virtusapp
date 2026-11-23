import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(4),
});

export const correctiveCreateSchema = z.object({
  title: z.string().min(2).max(180),
  description: z.string().min(2),
  severity: z.enum(["Critical", "High", "Medium", "Low"]).default("High"),
  status: z.enum(["Reported", "Diagnosing", "In Repair", "Resolved"]).default("Reported"),
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
  frequency: z.enum(["Monthly", "Quarterly", "Semi-Annual", "Annual"]).default("Quarterly"),
  status: z.enum(["Scheduled", "In Progress", "Verification", "Completed"]).default("Scheduled"),
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
  status: z.enum(["Kickoff", "Configuration", "UAT / Staging", "Go-Live"]).default("Kickoff"),
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
  status: z.enum(["Scoping", "Active Trial", "Evaluation", "Approved"]).default("Scoping"),
  outcome: z.enum(["Pending", "Success", "Extended", "Dropped"]).default("Pending"),
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
  stage: z.enum(["Contacted", "Negotiation", "Offer Sent", "Deal Closed"]).default("Contacted"),
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
  tier: z.enum(["Enterprise", "Mid-Market", "SMB"]).default("Enterprise"),
  status: z.enum(["Active", "Onboarding", "Prospect", "Inactive"]).default("Active"),
  contactName: z.string().min(2).max(120),
  contactEmail: z.string().email(),
  contactPhone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  managerId: z.number().int().positive().optional().nullable(),
});

export const partnerCreateSchema = z.object({
  name: z.string().min(2).max(160),
  partnerType: z
    .enum(["Vendor / Principal", "System Integrator", "Reseller", "Subcontractor"])
    .default("Vendor / Principal"),
  tier: z.enum(["Platinum", "Gold", "Silver", "Authorized"]).default("Gold"),
  specialization: z.string().min(2),
  contactName: z.string().min(2).max(120),
  contactEmail: z.string().email(),
  contactPhone: z.string().optional().nullable(),
  escalationEmail: z.string().email().optional().nullable().or(z.literal("")),
  address: z.string().optional().nullable(),
  status: z.enum(["Active", "Onboarding", "Inactive"]).default("Active"),
  notes: z.string().optional().nullable(),
});

export const serviceCreateSchema = z.object({
  serviceNumber: z.string().min(3).max(64),
  title: z.string().min(2).max(160),
  category: z.string().min(2).max(80),
  slaTier: z.enum(["24x7 Platinum", "8x5 Gold", "Standard"]).default("24x7 Platinum"),
  status: z.enum(["Active", "Provisioning", "Suspended", "Expiring Soon", "Expired"]).default("Active"),
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
  status: z.enum(["Active", "Beta", "End of Support"]).default("Active"),
});

export const eventCreateSchema = z.object({
  title: z.string().min(2).max(180),
  description: z.string().min(2),
  eventType: z
    .enum([
      "PM Reminder",
      "SLA Alert",
      "Contract Renewal",
      "POC Review",
      "Implementation Milestone",
      "Weekly Report",
      "Custom Event",
    ])
    .default("PM Reminder"),
  linkedModule: z
    .enum(["corrective", "preventive", "implementation", "poc", "service", "pipeline", "general"])
    .default("general"),
  linkedRefCode: z.string().optional().nullable(),
  scheduledAt: z.string(),
  recurrence: z.enum(["Once", "Daily", "Weekly", "Monthly"]).default("Once"),
  reminderMinutesBefore: z.number().int().min(0).default(60),
  recipientEmails: z.array(z.string().email()).min(1),
  emailSubject: z.string().min(2).max(200),
  emailBody: z.string().min(2),
  status: z.enum(["Scheduled", "Sent", "Paused", "Failed"]).default("Scheduled"),
});

export const userCreateSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(6),
  jobTitle: z.string().min(2).max(120),
  department: z.string().min(2).max(100).default("Managed Services"),
  phone: z.string().optional().nullable(),
  avatarColor: z.string().default("#18181A"),
  availability: z.enum(["Online", "On Duty", "Away", "Offline"]).default("Online"),
  isActive: z.boolean().default(true),
  roleId: z.number().int().positive(),
});

export const roleCreateSchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().default(""),
  permissions: z.array(z.string()).default([]),
});
