export const PERMISSIONS = [
  { key: "dashboard:read", module: "Dashboard", label: "View executive dashboard" },
  { key: "maintenance:read", module: "Maintenance", label: "View corrective & preventive tickets" },
  { key: "maintenance:write", module: "Maintenance", label: "Create & update maintenance tickets" },
  { key: "maintenance:delete", module: "Maintenance", label: "Delete maintenance tickets" },
  { key: "delivery:read", module: "Delivery & POC", label: "View implementations & POC status" },
  { key: "delivery:write", module: "Delivery & POC", label: "Create & update implementations & POCs" },
  { key: "delivery:delete", module: "Delivery & POC", label: "Delete implementations & POCs" },
  { key: "customers:read", module: "CRM & Partners", label: "View customers & business partners" },
  { key: "customers:write", module: "CRM & Partners", label: "Create & update customers & partners" },
  { key: "customers:delete", module: "CRM & Partners", label: "Delete customers & partners" },
  { key: "services:read", module: "Service Numbers", label: "View service number registry" },
  { key: "services:write", module: "Service Numbers", label: "Create & update service numbers" },
  { key: "services:delete", module: "Service Numbers", label: "Delete service numbers" },
  { key: "products:read", module: "Products", label: "View product & solution catalog" },
  { key: "products:write", module: "Products", label: "Create & update products & solutions" },
  { key: "products:delete", module: "Products", label: "Delete products & solutions" },
  { key: "pipeline:read", module: "Pipeline", label: "View sales & renewal pipeline" },
  { key: "pipeline:write", module: "Pipeline", label: "Create & update pipeline deals" },
  { key: "pipeline:delete", module: "Pipeline", label: "Delete pipeline deals" },
  { key: "events:read", module: "Events & Alerts", label: "View scheduled reminders & alert logs" },
  { key: "events:write", module: "Events & Alerts", label: "Create & schedule reminder events" },
  { key: "events:dispatch", module: "Events & Alerts", label: "Trigger immediate email alerts" },
  { key: "events:delete", module: "Events & Alerts", label: "Delete scheduled events" },
  { key: "reports:read", module: "Reporting", label: "View operational reports" },
  { key: "reports:export", module: "Reporting", label: "Export CSV & email reports" },
  { key: "users:read", module: "User Management", label: "View team members directory" },
  { key: "users:manage", module: "User Management", label: "Create, edit & deactivate users" },
  { key: "rbac:manage", module: "User Management", label: "Edit roles & permission matrix" },
  { key: "settings:manage", module: "Settings", label: "Configure SMTP & alert defaults" },
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number]["key"];

export const ALL_PERMISSION_KEYS: PermissionKey[] = PERMISSIONS.map((p) => p.key);

export const DEFAULT_ROLE_DEFINITIONS: Array<{
  name: string;
  slug: string;
  description: string;
  isSystem: boolean;
  permissions: PermissionKey[];
}> = [
  {
    name: "Super Admin",
    slug: "super_admin",
    description: "Unrestricted platform administrator with full RBAC, SMTP, and operational control.",
    isSystem: true,
    permissions: [...ALL_PERMISSION_KEYS],
  },
  {
    name: "Service Manager",
    slug: "service_manager",
    description: "Leads managed service delivery, SLA governance, event alerts, and customer operations.",
    isSystem: true,
    permissions: [
      "dashboard:read",
      "maintenance:read",
      "maintenance:write",
      "maintenance:delete",
      "delivery:read",
      "delivery:write",
      "customers:read",
      "customers:write",
      "services:read",
      "services:write",
      "products:read",
      "products:write",
      "pipeline:read",
      "pipeline:write",
      "events:read",
      "events:write",
      "events:dispatch",
      "reports:read",
      "reports:export",
      "users:read",
      "users:manage",
    ],
  },
  {
    name: "Field Engineer",
    slug: "field_engineer",
    description: "Handles corrective break-fix tickets, preventive maintenance checklists, implementations, and POC trials.",
    isSystem: true,
    permissions: [
      "dashboard:read",
      "maintenance:read",
      "maintenance:write",
      "delivery:read",
      "delivery:write",
      "customers:read",
      "services:read",
      "products:read",
      "events:read",
      "events:write",
      "reports:read",
      "users:read",
    ],
  },
  {
    name: "Account Lead",
    slug: "account_lead",
    description: "Manages customer & partner relationships, pipeline deals, POCs, and service contracts.",
    isSystem: true,
    permissions: [
      "dashboard:read",
      "maintenance:read",
      "delivery:read",
      "delivery:write",
      "customers:read",
      "customers:write",
      "services:read",
      "services:write",
      "products:read",
      "pipeline:read",
      "pipeline:write",
      "events:read",
      "events:write",
      "reports:read",
      "reports:export",
      "users:read",
    ],
  },
  {
    name: "Viewer",
    slug: "viewer",
    description: "Read-only auditor access across service operations, contracts, and executive reports.",
    isSystem: true,
    permissions: [
      "dashboard:read",
      "maintenance:read",
      "delivery:read",
      "customers:read",
      "services:read",
      "products:read",
      "pipeline:read",
      "events:read",
      "reports:read",
      "users:read",
    ],
  },
];

export function hasPermission(userPermissions: string[], required?: PermissionKey): boolean {
  if (!required) return true;
  return userPermissions.includes(required);
}
