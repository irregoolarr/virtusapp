import assert from "node:assert/strict";
import test from "node:test";

const BASE_URL = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";
// The database starts empty except for the bootstrap admin (see src/db/seed.ts).
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL ?? "";
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD ?? "";
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  throw new Error("Set TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD (the bootstrap Super Admin) to run the tests.");
}

async function api(path: string, options: RequestInit = {}, cookie?: string) {
  const headers = new Headers(options.headers);
  if (cookie) headers.set("cookie", cookie);
  if (options.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
    redirect: "manual",
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { res, status: res.status, json, text };
}

async function loginAs(email: string, password = ADMIN_PASSWORD): Promise<string> {
  const { res, status, json } = await api("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  assert.equal(status, 200, `Login failed for ${email}: ${JSON.stringify(json)}`);
  const setCookie = res.headers.get("set-cookie");
  assert.ok(setCookie, "Expected Set-Cookie header");
  return setCookie.split(";")[0];
}

test("All UI routes return HTTP 200", async () => {
  const routes = [
    "/",
    "/login",
    "/corrective",
    "/preventive",
    "/implementations",
    "/poc",
    "/pipeline",
    "/customers",
    "/services",
    "/products",
    "/events",
    "/reports",
    "/team",
    "/settings",
  ];
  for (const route of routes) {
    const res = await fetch(`${BASE_URL}${route}`);
    assert.equal(res.status, 200, `Expected 200 for ${route}`);
  }
});

test("Health & authentication boundary checks", async () => {
  const health = await api("/api/health");
  assert.equal(health.status, 200);
  assert.equal((health.json as { ok: boolean; database: string }).ok, true);
  assert.equal((health.json as { ok: boolean; database: string }).database, "postgresql");

  for (const endpoint of [
    "/api/dashboard",
    "/api/maintenance/corrective",
    "/api/maintenance/preventive",
    "/api/implementations",
    "/api/poc",
    "/api/pipeline",
    "/api/customers",
    "/api/partners",
    "/api/services",
    "/api/products",
    "/api/events",
    "/api/reports",
    "/api/users",
    "/api/roles",
    "/api/settings",
  ]) {
    const unauth = await api(endpoint);
    assert.equal(unauth.status, 401, `${endpoint} must require authentication`);
  }
});

/** Create a throw-away user with the given role; returns its id, email and password. */
async function createTempUser(adminCookie: string, roleSlug: string) {
  const roles = await api("/api/roles", {}, adminCookie);
  const role = (roles.json as { items: Array<{ id: number; slug: string }> }).items.find((r) => r.slug === roleSlug);
  assert.ok(role, `role ${roleSlug} must exist`);
  const email = `test-${roleSlug}-${Date.now()}@vms-test.example`;
  const password = "test-password-123";
  const res = await api(
    "/api/users",
    { method: "POST", body: JSON.stringify({ name: `Test ${roleSlug}`, email, password, jobTitle: "QA", roleId: role.id }) },
    adminCookie
  );
  assert.equal(res.status, 201, JSON.stringify(res.json));
  return { id: (res.json as { item: { id: number } }).item.id, email, password };
}

test("RBAC enforcement across Viewer, Field Engineer, and Super Admin", async () => {
  const adminCookie = await loginAs(ADMIN_EMAIL);
  const viewer = await createTempUser(adminCookie, "viewer");
  const engineer = await createTempUser(adminCookie, "field_engineer");

  const viewerCookie = await loginAs(viewer.email, viewer.password);
  const dash = await api("/api/dashboard", {}, viewerCookie);
  assert.equal(dash.status, 200);

  const cmDeny = await api(
    "/api/maintenance/corrective",
    {
      method: "POST",
      body: JSON.stringify({
        title: "Unauthorized ticket",
        description: "Should fail for viewer",
      }),
    },
    viewerCookie
  );
  assert.equal(cmDeny.status, 403);

  const settingsDeny = await api("/api/settings", {}, viewerCookie);
  assert.equal(settingsDeny.status, 403);

  const engineerCookie = await loginAs(engineer.email, engineer.password);
  const engCreateCm = await api(
    "/api/maintenance/corrective",
    {
      method: "POST",
      body: JSON.stringify({
        title: "Test Optical Power Check",
        description: "Automated verification incident",
        severity: "Low",
        status: "Reported",
      }),
    },
    engineerCookie
  );
  assert.equal(engCreateCm.status, 201);
  const createdId = (engCreateCm.json as { item: { id: number } }).item.id;

  // Field engineer cannot delete maintenance or manage users
  const engDeleteDeny = await api(
    `/api/maintenance/corrective/${createdId}`,
    { method: "DELETE" },
    engineerCookie
  );
  assert.equal(engDeleteDeny.status, 403);

  const engUserDeny = await api(
    "/api/users",
    {
      method: "POST",
      body: JSON.stringify({
        name: "Bad",
        email: "bad@virtusms.io",
        password: "password123",
        jobTitle: "Eng",
        roleId: 1,
      }),
    },
    engineerCookie
  );
  assert.equal(engUserDeny.status, 403);

  const cleanup = await api(
    `/api/maintenance/corrective/${createdId}`,
    { method: "DELETE" },
    adminCookie
  );
  assert.equal(cleanup.status, 200);

  for (const u of [viewer, engineer]) {
    const del = await api(`/api/users/${u.id}`, { method: "DELETE" }, adminCookie);
    assert.equal(del.status, 200);
  }
});

test("All modules CRUD, Comments, Event Reminder Alerting & Reporting CSV flow", async () => {
  const adminCookie = await loginAs(ADMIN_EMAIL);

  // 1. Business Partner & Customer CRUD
  const ptrRes = await api(
    "/api/partners",
    {
      method: "POST",
      body: JSON.stringify({
        name: "Test Partner Net",
        partnerType: "Vendor / Principal",
        tier: "Gold",
        specialization: "Optical Transport",
        contactName: "Samira Khan",
        contactEmail: "samira@partner.example",
      }),
    },
    adminCookie
  );
  assert.equal(ptrRes.status, 201);
  const partnerId = (ptrRes.json as { item: { id: number } }).item.id;

  const custRes = await api(
    "/api/customers",
    {
      method: "POST",
      body: JSON.stringify({
        name: "Test Verification Corp",
        industry: "Telecom",
        tier: "Enterprise",
        status: "Active",
        contactName: "Alex Rivera",
        contactEmail: "alex@testcorp.example",
      }),
    },
    adminCookie
  );
  assert.equal(custRes.status, 201);
  const customerId = (custRes.json as { item: { id: number } }).item.id;

  // 2. Product & Service Number CRUD
  const prodRes = await api(
    "/api/products",
    {
      method: "POST",
      body: JSON.stringify({
        sku: "PRD-TEST-888",
        name: "Managed Optical Ring",
        category: "Infrastructure",
        vendorName: "Test Partner Net",
        partnerId,
        description: "Test managed solution",
        slaTargetHours: 2,
        unitPriceIdr: 900,
      }),
    },
    adminCookie
  );
  assert.equal(prodRes.status, 201);
  const productId = (prodRes.json as { item: { id: number } }).item.id;

  const srvRes = await api(
    "/api/services",
    {
      method: "POST",
      body: JSON.stringify({
        serviceNumber: "SRV-TEST-9901",
        title: "Automated Integration Circuit",
        category: "Managed Network",
        slaTier: "24x7 Platinum",
        status: "Active",
        monthlyFeeIdr: 1200,
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        customerId,
        partnerId,
        productId,
      }),
    },
    adminCookie
  );
  assert.equal(srvRes.status, 201);
  const serviceId = (srvRes.json as { item: { id: number } }).item.id;

  // 3. Preventive, Implementation, POC & Pipeline CRUD + Comment
  const pmRes = await api(
    "/api/maintenance/preventive",
    {
      method: "POST",
      body: JSON.stringify({
        title: "Test PM Check",
        description: "Quarterly check",
        frequency: "Quarterly",
        status: "Scheduled",
        scheduledDate: "2026-12-01",
        checklist: [{ id: "1", label: "Check optics", done: false }],
        customerId,
        serviceNumberId: serviceId,
      }),
    },
    adminCookie
  );
  assert.equal(pmRes.status, 201);
  const pmId = (pmRes.json as { item: { id: number } }).item.id;

  const impRes = await api(
    "/api/implementations",
    {
      method: "POST",
      body: JSON.stringify({
        title: "Test Rollout",
        description: "Stage 1 rollout",
        status: "Kickoff",
        progressPct: 25,
        customerId,
      }),
    },
    adminCookie
  );
  assert.equal(impRes.status, 201);
  const impId = (impRes.json as { item: { id: number } }).item.id;

  const pocRes = await api(
    "/api/poc",
    {
      method: "POST",
      body: JSON.stringify({
        title: "Test POC",
        description: "Evaluate latency",
        status: "Active Trial",
        successCriteria: "Latency < 20ms",
        customerId,
      }),
    },
    adminCookie
  );
  assert.equal(pocRes.status, 201);
  const pocId = (pocRes.json as { item: { id: number } }).item.id;

  const dealRes = await api(
    "/api/pipeline",
    {
      method: "POST",
      body: JSON.stringify({
        title: "Test Pipeline Deal",
        description: "Managed expansion",
        stage: "Contacted",
        dealValueIdr: 5000,
        customerId,
      }),
    },
    adminCookie
  );
  assert.equal(dealRes.status, 201);
  const dealId = (dealRes.json as { item: { id: number } }).item.id;

  const commentRes = await api(
    "/api/comments",
    {
      method: "POST",
      body: JSON.stringify({
        entityType: "pipeline",
        entityId: dealId,
        body: "Automated integration test comment",
      }),
    },
    adminCookie
  );
  assert.equal(commentRes.status, 201);

  // 4. Custom Role create + delete
  const roleRes = await api(
    "/api/roles",
    {
      method: "POST",
      body: JSON.stringify({
        name: "Temp Test Role",
        description: "Integration check",
        permissions: ["dashboard:read"],
      }),
    },
    adminCookie
  );
  assert.equal(roleRes.status, 201);
  const roleId = (roleRes.json as { item: { id: number } }).item.id;

  // 5. Schedule due Event and run processor + test alert email
  const pastIso = new Date(Date.now() - 120_000).toISOString();
  const evtRes = await api(
    "/api/events",
    {
      method: "POST",
      body: JSON.stringify({
        title: "Automated Integration Reminder",
        description: "Verify email alert outbox dispatch",
        eventType: "Contract Renewal",
        linkedModule: "service",
        linkedRefCode: "SRV-TEST-9901",
        scheduledAt: pastIso,
        recurrence: "Once",
        reminderMinutesBefore: 0,
        recipientEmails: ["alerts-test@virtusms.io"],
        emailSubject: "[Integration Test] SRV-TEST-9901 Reminder",
        emailBody: "Automated alert pipeline check.",
      }),
    },
    adminCookie
  );
  assert.equal(evtRes.status, 201);
  const eventId = (evtRes.json as { item: { id: number } }).item.id;

  const procRes = await api("/api/events/process", { method: "POST", body: "{}" }, adminCookie);
  assert.equal(procRes.status, 200);
  const processed = procRes.json as {
    processedCount: number;
    logs: Array<{ eventId: number; status: string }>;
  };
  assert.ok(processed.processedCount >= 1);
  assert.ok(processed.logs.some((l) => l.eventId === eventId));

  const evList = await api("/api/events", {}, adminCookie);
  assert.equal(evList.status, 200);
  const logs = (evList.json as { logs: Array<{ subject: string }> }).logs;
  assert.ok(logs.some((l) => l.subject === "[Integration Test] SRV-TEST-9901 Reminder"));

  // 6. Verify CSV Report export & Email Digest dispatch
  const csvRes = await api("/api/reports?format=csv&scope=all", {}, adminCookie);
  assert.equal(csvRes.status, 200);
  assert.ok(csvRes.text.includes("SECTION,CODE,TITLE"));
  assert.ok(csvRes.text.includes("SRV-TEST-9901"));

  const digestRes = await api(
    "/api/reports",
    {
      method: "POST",
      body: JSON.stringify({ recipients: ["exec-test@virtusms.io"] }),
    },
    adminCookie
  );
  assert.equal(digestRes.status, 200);

  // Cleanup all test records
  await api(`/api/events/${eventId}`, { method: "DELETE" }, adminCookie);
  await api(`/api/roles/${roleId}`, { method: "DELETE" }, adminCookie);
  await api(`/api/pipeline/${dealId}`, { method: "DELETE" }, adminCookie);
  await api(`/api/poc/${pocId}`, { method: "DELETE" }, adminCookie);
  await api(`/api/implementations/${impId}`, { method: "DELETE" }, adminCookie);
  await api(`/api/maintenance/preventive/${pmId}`, { method: "DELETE" }, adminCookie);
  await api(`/api/services/${serviceId}`, { method: "DELETE" }, adminCookie);
  await api(`/api/products/${productId}`, { method: "DELETE" }, adminCookie);
  await api(`/api/customers/${customerId}`, { method: "DELETE" }, adminCookie);
  await api(`/api/partners/${partnerId}`, { method: "DELETE" }, adminCookie);
});

test("Corrective: resolution detail, activity history, attachments", async () => {
  const adminCookie = await loginAs(ADMIN_EMAIL);

  const created = await api(
    "/api/maintenance/corrective",
    { method: "POST", body: JSON.stringify({ title: "Attachment flow test", description: "Automated", severity: "High" }) },
    adminCookie
  );
  assert.equal(created.status, 201);
  const id = (created.json as { item: { id: number; ticketCode: string } }).item.id;

  // Resolving without a resolution detail is refused
  const noDetail = await api(`/api/maintenance/corrective/${id}`, { method: "PATCH", body: JSON.stringify({ status: "Resolved" }) }, adminCookie);
  assert.equal(noDetail.status, 400);

  // Priority change is recorded
  const prio = await api(`/api/maintenance/corrective/${id}`, { method: "PATCH", body: JSON.stringify({ severity: "Critical" }) }, adminCookie);
  assert.equal(prio.status, 200);

  // Upload, list, download, delete an attachment (database storage when Drive is not configured)
  const form = new FormData();
  form.set("entityType", "corrective");
  form.set("entityId", String(id));
  form.set("file", new Blob(["hello cm document"], { type: "text/plain" }), "cm-report.txt");
  const upload = await fetch(`${BASE_URL}/api/attachments`, { method: "POST", body: form, headers: { cookie: adminCookie } });
  assert.equal(upload.status, 201);
  const attId = ((await upload.json()) as { item: { id: number } }).item.id;

  const blocked = new FormData();
  blocked.set("entityType", "corrective");
  blocked.set("entityId", String(id));
  blocked.set("file", new Blob(["<script>"], { type: "text/html" }), "evil.html");
  const blockedRes = await fetch(`${BASE_URL}/api/attachments`, { method: "POST", body: blocked, headers: { cookie: adminCookie } });
  assert.equal(blockedRes.status, 400);

  const list = await api(`/api/attachments?entityType=corrective&entityId=${id}`, {}, adminCookie);
  assert.equal((list.json as { items: unknown[] }).items.length, 1);

  const download = await api(`/api/attachments/${attId}`, {}, adminCookie);
  assert.equal(download.status, 200);
  assert.equal(download.text, "hello cm document");

  const resolved = await api(
    `/api/maintenance/corrective/${id}`,
    { method: "PATCH", body: JSON.stringify({ status: "Resolved", resolutionDetail: "Replaced the faulty SFP" }) },
    adminCookie
  );
  assert.equal(resolved.status, 200);

  const history = await api(`/api/activities?entityType=corrective&entityId=${id}`, {}, adminCookie);
  const categories = (history.json as { items: Array<{ category: string }> }).items.map((a) => a.category);
  for (const expected of ["Ticket Logged", "Priority Change", "Attachment Added", "Resolution"]) {
    assert.ok(categories.includes(expected), `activity "${expected}" missing: ${categories.join(", ")}`);
  }

  // System history cannot be deleted; notes can
  const sys = (history.json as { items: Array<{ id: number; type: string }> }).items.find((a) => a.type !== "Note");
  assert.ok(sys);
  const sysDel = await api(`/api/activities/${sys.id}`, { method: "DELETE" }, adminCookie);
  assert.equal(sysDel.status, 400);

  const attDel = await api(`/api/attachments/${attId}`, { method: "DELETE" }, adminCookie);
  assert.equal(attDel.status, 200);

  const cleanup = await api(`/api/maintenance/corrective/${id}`, { method: "DELETE" }, adminCookie);
  assert.equal(cleanup.status, 200);
  const after = await api(`/api/activities?entityType=corrective&entityId=${id}`, {}, adminCookie);
  assert.equal((after.json as { items: unknown[] }).items.length, 0);
});
