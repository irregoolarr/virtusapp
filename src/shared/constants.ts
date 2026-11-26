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

// ---- Preventive maintenance ----------------------------------------------------

/** Equipment / service domain → item type for preventive visits. */
export const PM_CATEGORIES: Record<string, readonly string[]> = {
  Network: ["Router", "Switch", "Wireless AP", "SD-WAN / Link"],
  Security: ["Firewall", "VPN Gateway", "Endpoint / EDR", "SIEM / Logging"],
  "Server & Storage": ["Server Hardware", "OS Patching", "Backup Verification", "Storage Array", "Virtualization"],
  "Power & Facility": ["UPS", "Generator", "Cooling / HVAC", "Rack & Cabling"],
  Application: ["Health Check", "License Renewal", "Certificate Renewal"],
  Other: ["General"],
};
export const PM_CATEGORY_NAMES = Object.keys(PM_CATEGORIES);

/** Standard inspection steps per item type (pre-filled on new plans; editable). */
export const PM_CHECKLIST_TEMPLATES: Record<string, readonly string[]> = {
  Router: ["Check firmware version & advisories", "Review interface errors / CRC", "Verify routing table & BGP sessions", "Back up configuration", "Check CPU / memory / temperature"],
  Switch: ["Check firmware version & advisories", "Review port errors & STP topology", "Verify uplink redundancy", "Back up configuration", "Check PoE budget & temperature"],
  Firewall: ["Review firmware version & advisories", "Check HA sync status", "Review unused / shadowed rules", "Back up configuration", "Check CPU / memory / session usage"],
  "VPN Gateway": ["Check certificate expiry", "Review active tunnels & failures", "Verify MFA / RADIUS integration", "Back up configuration"],
  "Server Hardware": ["Check hardware health (iLO / iDRAC)", "Review disk / RAID status", "Check fans, PSU and temperature", "Review system event log"],
  "OS Patching": ["Snapshot / back up before patching", "Apply approved patches", "Reboot & verify services", "Document installed KBs / packages"],
  "Backup Verification": ["Check last backup job results", "Test-restore a sample", "Verify retention & offsite copy", "Check backup storage capacity"],
  UPS: ["Run battery self-test", "Check load percentage", "Review alarms & event log", "Verify input / output voltage", "Check room temperature & vents"],
  Generator: ["Run test start under load", "Check fuel level", "Inspect battery & charger", "Review maintenance log"],
  "Health Check": ["Review application logs for errors", "Check response time / availability", "Verify integrations", "Check disk / database growth"],
  "Certificate Renewal": ["List certificates expiring in 60 days", "Renew / replace certificates", "Verify chain & bindings", "Update inventory"],
};
export const PM_DEFAULT_CHECKLIST = [
  "Verify backup & rollback readiness",
  "Run health inspection & capture metrics",
  "Review logs for errors",
  "Update documentation",
] as const;

/** Months between visits for each frequency. */
export const PM_FREQUENCY_MONTHS: Record<string, number> = { Monthly: 1, Quarterly: 3, "Semi-Annual": 6, Annual: 12 };
/** A visit counts as "due soon" this many days ahead. */
export const PM_DUE_SOON_DAYS = 3;

// ---- Implementations -------------------------------------------------------------

export const IMPLEMENTATION_TYPES = [
  "Network Deployment",
  "Security Deployment",
  "Data Center / Cloud",
  "Software Rollout",
  "Managed Service Onboarding",
  "Migration / Upgrade",
  "Other",
] as const;
/** Lead is reminded this many days before the target go-live. */
export const IMPL_DUE_SOON_DAYS = 7;

// ---- POC -------------------------------------------------------------------------

/** Decisions that end (Success, Dropped) or prolong (Extended) a POC. */
export const POC_DECISIONS = ["Success", "Extended", "Dropped"] as const;
export const isPocFinished = (outcome: string) => outcome === "Success" || outcome === "Dropped";
/** Lead is reminded this many days before the review date. */
export const POC_DUE_SOON_DAYS = 3;

/** Deleted records stay in the Recycle Bin this long, then are purged for good. */
export const RECYCLE_BIN_DAYS = 30;
