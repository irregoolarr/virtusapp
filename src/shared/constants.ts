// Domain constants shared by the browser UI and the API (no server imports here).

export const CORRECTIVE_STAGES = ["Reported", "Diagnosing", "In Repair", "Resolved"] as const;
export const SEVERITIES = ["Critical", "High", "Medium", "Low"] as const;

export const PREVENTIVE_STAGES = ["Scheduled", "In Progress", "Verification", "Completed"] as const;
export const PM_FREQUENCIES = ["Monthly", "Quarterly", "Semi-Annual", "Annual"] as const;

export const IMPLEMENTATION_STAGES = ["Kickoff", "Configuration", "UAT / Staging", "Go-Live"] as const;

export const POC_STAGES = ["Scoping", "Active Trial", "Evaluation", "Approved"] as const;
export const POC_OUTCOMES = ["Pending", "Success", "Extended", "Dropped"] as const;

export const PIPELINE_STAGES = ["Contacted", "Negotiation", "Offer Sent", "Deal Closed"] as const;

export const CUSTOMER_TIERS = ["Enterprise", "Mid-Market", "SMB"] as const;
export const CUSTOMER_STATUSES = ["Active", "Onboarding", "Prospect", "Inactive"] as const;

export const PARTNER_TYPES = ["Vendor / Principal", "System Integrator", "Reseller", "Subcontractor"] as const;
export const PARTNER_TIERS = ["Platinum", "Gold", "Silver", "Authorized"] as const;
export const PARTNER_STATUSES = ["Active", "Onboarding", "Inactive"] as const;

export const SLA_TIERS = ["24x7 Platinum", "8x5 Gold", "Standard"] as const;
export const SERVICE_STATUSES = ["Active", "Provisioning", "Suspended", "Expiring Soon", "Expired"] as const;

export const PRODUCT_STATUSES = ["Active", "Beta", "End of Support"] as const;

export const EVENT_TYPES = [
  "PM Reminder",
  "SLA Alert",
  "Contract Renewal",
  "POC Review",
  "Implementation Milestone",
  "Weekly Report",
  "Custom Event",
] as const;
export const EVENT_MODULES = ["corrective", "preventive", "implementation", "poc", "service", "pipeline", "general"] as const;
export const EVENT_RECURRENCES = ["Once", "Daily", "Weekly", "Monthly"] as const;
export const EVENT_STATUSES = ["Scheduled", "Sent", "Paused", "Failed"] as const;

export const AVAILABILITIES = ["Online", "On Duty", "Away", "Offline"] as const;

export const COMMENT_ENTITY_TYPES = ["corrective", "preventive", "implementation", "poc", "pipeline", "customer"] as const;

/** Max upload size. Vercel rejects request bodies above ~4.5 MB. */
export const ATTACHMENT_MAX_BYTES = 4 * 1024 * 1024;
