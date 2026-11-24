// Domain constants shared by the browser UI and the API (no server imports here).

export const CORRECTIVE_STAGES = ["Reported", "Diagnosing", "In Repair", "Resolved", "Closed"] as const;
/** Stages where work is finished (Resolved = fix applied, Closed = customer confirmed). */
export const CORRECTIVE_DONE_STAGES = ["Resolved", "Closed"] as const;
export const isCorrectiveDone = (status: string) => (CORRECTIVE_DONE_STAGES as readonly string[]).includes(status);

/** Default SLA (hours to resolve) by priority, used when no SLA target date is given. */
export const SLA_HOURS_BY_SEVERITY: Record<string, number> = { Critical: 4, High: 8, Medium: 24, Low: 72 };

export const CM_SOURCES = ["Phone", "Email", "Portal", "WhatsApp", "Monitoring Alert", "Walk-in"] as const;

/** Category → subcategories for corrective tickets (drives reporting). */
export const CM_CATEGORIES: Record<string, readonly string[]> = {
  Network: ["Link Down", "Packet Loss / Latency", "Routing / BGP", "Switching / VLAN", "Wireless"],
  Security: ["Firewall", "VPN", "Endpoint / EDR", "SIEM / Logging", "Authentication / SSO"],
  "Server & Storage": ["Hardware Failure", "OS / Patching", "Storage / Backup", "Virtualization"],
  Application: ["Error Message", "Performance", "Integration / API", "Licensing"],
  "Account & Access": ["Account Lockout", "Password Reset", "Permission Request"],
  "Email & Collaboration": ["Delivery Failure", "Mailbox", "Spam / Phishing"],
  "Power & Facility": ["UPS / Power", "Cooling", "Physical Damage"],
  Other: ["General"],
};
export const CM_CATEGORY_NAMES = Object.keys(CM_CATEGORIES);
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

/** Max upload size through the app. Vercel rejects request bodies above ~4.5 MB. */
export const ATTACHMENT_MAX_BYTES = 4 * 1024 * 1024;
/** Max size for files uploaded directly from the browser to Google Drive. */
export const ATTACHMENT_MAX_BYTES_DRIVE = 100 * 1024 * 1024;
/** File types the app will show inline (preview); everything else is download-only. */
export const PREVIEWABLE_MIME = ["application/pdf", "image/png", "image/jpeg", "image/gif", "image/webp", "text/plain", "text/csv"] as const;
