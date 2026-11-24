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

test("Corrective: categories, SLA default & breach alert, resolve → close → reopen, preview", async () => {
  const adminCookie = await loginAs(ADMIN_EMAIL);
  const post = (path: string, body: unknown) => api(path, { method: "POST", body: JSON.stringify(body) }, adminCookie);

  // Invalid subcategory is refused
  const badCat = await post("/api/maintenance/corrective", {
    title: "Bad category",
    description: "x",
    category: "Network",
    subcategory: "Account Lockout",
  });
  assert.equal(badCat.status, 400);

  // Default SLA target comes from priority (Critical = 4h)
  const before = Date.now();
  const created = await post("/api/maintenance/corrective", {
    title: "Lifecycle test",
    description: "Automated lifecycle test",
    severity: "Critical",
    category: "Network",
    subcategory: "Link Down",
    source: "Phone",
  });
  assert.equal(created.status, 201, JSON.stringify(created.json));
  const ticket = (created.json as { item: { id: number; dueDate: string; category: string; source: string } }).item;
  const hours = (new Date(ticket.dueDate).getTime() - before) / 3_600_000;
  assert.ok(hours > 3.9 && hours < 4.1, `Critical SLA should be ~4h, got ${hours}`);
  assert.equal(ticket.category, "Network");
  assert.equal(ticket.source, "Phone");
  const id = ticket.id;

  // A service number must belong to the ticket's customer
  const custA = await post("/api/customers", { name: "SLA Cust A", industry: "Telecom", contactName: "Contact A", contactEmail: "a@cust.example" });
  const custB = await post("/api/customers", { name: "SLA Cust B", industry: "Telecom", contactName: "Contact B", contactEmail: "b@cust.example" });
  const custAId = (custA.json as { item: { id: number } }).item.id;
  const custBId = (custB.json as { item: { id: number } }).item.id;
  const srv = await post("/api/services", {
    serviceNumber: `SRV-SLA-${Date.now()}`,
    title: "Test link",
    category: "Connectivity",
    startDate: "2026-01-01",
    endDate: "2027-01-01",
    customerId: custAId,
  });
  const srvId = (srv.json as { item: { id: number } }).item.id;
  const mismatch = await api(
    `/api/maintenance/corrective/${id}`,
    { method: "PATCH", body: JSON.stringify({ customerId: custBId, serviceNumberId: srvId }) },
    adminCookie
  );
  assert.equal(mismatch.status, 400);
  const match = await api(
    `/api/maintenance/corrective/${id}`,
    { method: "PATCH", body: JSON.stringify({ customerId: custAId, serviceNumberId: srvId }) },
    adminCookie
  );
  assert.equal(match.status, 200);

  // Past SLA target → breach alert is recorded once
  const past = await api(
    `/api/maintenance/corrective/${id}`,
    { method: "PATCH", body: JSON.stringify({ dueDate: new Date(Date.now() - 60_000).toISOString() }) },
    adminCookie
  );
  assert.equal(past.status, 200);
  const run = await post("/api/events/process", {});
  assert.equal(run.status, 200);
  assert.ok((run.json as { sla: { breached: number } }).sla.breached >= 1);
  const run2 = await post("/api/events/process", {});
  assert.equal((run2.json as { sla: { breached: number } }).sla.breached, 0, "breach alert must not repeat");

  // Close is only allowed after resolve
  const earlyClose = await post(`/api/maintenance/corrective/${id}/close`, {});
  assert.equal(earlyClose.status, 400);

  const resolved = await post(`/api/maintenance/corrective/${id}/resolve`, { resolutionDetail: "Replaced the SFP module", notifyCustomer: true });
  assert.equal(resolved.status, 200, JSON.stringify(resolved.json));
  const closed = await post(`/api/maintenance/corrective/${id}/close`, { note: "Customer confirmed" });
  assert.equal(closed.status, 200);
  assert.equal((closed.json as { item: { status: string } }).item.status, "Closed");

  const noReason = await post(`/api/maintenance/corrective/${id}/reopen`, { reason: "" });
  assert.equal(noReason.status, 400);
  const reopened = await post(`/api/maintenance/corrective/${id}/reopen`, { reason: "Link dropped again" });
  assert.equal(reopened.status, 200);
  const item = (reopened.json as { item: { status: string; reopenCount: number; closedAt: string | null } }).item;
  assert.equal(item.status, "Diagnosing");
  assert.equal(item.reopenCount, 1);
  assert.equal(item.closedAt, null);

  const history = await api(`/api/activities?entityType=corrective&entityId=${id}`, {}, adminCookie);
  const cats = (history.json as { items: Array<{ category: string; subject: string }> }).items;
  for (const expected of ["SLA Breach", "Resolution", "Closed", "Reopened"]) {
    assert.ok(cats.some((a) => a.category === expected), `missing activity ${expected}`);
  }
  assert.ok(cats.some((a) => a.subject.startsWith("Your incident")), "customer resolution email should be logged");

  // Preview: text is served inline, other types always download
  const cfg = await api("/api/attachments/config", {}, adminCookie);
  assert.equal(cfg.status, 200);
  const form = new FormData();
  form.set("entityType", "corrective");
  form.set("entityId", String(id));
  form.set("file", new Blob(["preview me"], { type: "text/plain" }), "notes.txt");
  const up = await fetch(`${BASE_URL}/api/attachments`, { method: "POST", body: form, headers: { cookie: adminCookie } });
  const attId = ((await up.json()) as { item: { id: number } }).item.id;
  const inline = await api(`/api/attachments/${attId}?inline=1`, {}, adminCookie);
  assert.match(inline.res.headers.get("content-disposition") ?? "", /^inline/);
  const download = await api(`/api/attachments/${attId}`, {}, adminCookie);
  assert.match(download.res.headers.get("content-disposition") ?? "", /^attachment/);

  // Cleanup
  assert.equal((await api(`/api/maintenance/corrective/${id}`, { method: "DELETE" }, adminCookie)).status, 200);
  assert.equal((await api(`/api/services/${srvId}`, { method: "DELETE" }, adminCookie)).status, 200);
  for (const c of [custAId, custBId]) assert.equal((await api(`/api/customers/${c}`, { method: "DELETE" }, adminCookie)).status, 200);
});

test("Preventive: type check, reminder & overdue alerts, complete → next visit, reopen", async () => {
  const adminCookie = await loginAs(ADMIN_EMAIL);
  const post = (path: string, body: unknown) => api(path, { method: "POST", body: JSON.stringify(body) }, adminCookie);
  const base = { description: "Automated PM test", frequency: "Quarterly", category: "Security", subcategory: "Firewall" };

  const badType = await post("/api/maintenance/preventive", { ...base, title: "Bad", subcategory: "UPS", scheduledDate: new Date().toISOString() });
  assert.equal(badType.status, 400);

  // Overdue visit (scheduled 2 days ago) and an upcoming one (in 12 hours)
  const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000);
  const overdue = await post("/api/maintenance/preventive", {
    ...base,
    title: "Overdue firewall PM",
    scheduledDate: twoDaysAgo.toISOString(),
    checklist: [
      { id: "a", label: "Back up config", done: true },
      { id: "b", label: "Check HA", done: false },
    ],
  });
  assert.equal(overdue.status, 201, JSON.stringify(overdue.json));
  const overdueId = (overdue.json as { item: { id: number } }).item.id;
  const soon = await post("/api/maintenance/preventive", { ...base, title: "Upcoming PM", scheduledDate: new Date(Date.now() + 12 * 3_600_000).toISOString() });
  const soonId = (soon.json as { item: { id: number } }).item.id;

  const run = await post("/api/events/process", {});
  const pm = (run.json as { pm: { reminded: number; overdue: number } }).pm;
  assert.ok(pm.overdue >= 1 && pm.reminded >= 1, JSON.stringify(pm));
  const again = (await post("/api/events/process", {})).json as { pm: { reminded: number; overdue: number } };
  assert.deepEqual(again.pm, { reminded: 0, overdue: 0 }, "PM alerts must not repeat");

  // "Completed" only through the Complete action
  const viaForm = await api(`/api/maintenance/preventive/${overdueId}`, { method: "PATCH", body: JSON.stringify({ status: "Completed" }) }, adminCookie);
  assert.equal(viaForm.status, 400);

  const done = await post(`/api/maintenance/preventive/${overdueId}/complete`, { completionNotes: "HA verified, config backed up", scheduleNext: true });
  assert.equal(done.status, 200, JSON.stringify(done.json));
  const { item, next } = done.json as {
    item: { status: string };
    next: { id: number; status: string; scheduledDate: string; checklist: Array<{ done: boolean }> };
  };
  assert.equal(item.status, "Completed");
  assert.equal(next.status, "Scheduled");
  assert.ok(next.checklist.every((c) => !c.done), "next visit checklist starts unticked");
  const expected = new Date(twoDaysAgo);
  expected.setMonth(expected.getMonth() + 3);
  assert.ok(Math.abs(new Date(next.scheduledDate).getTime() - expected.getTime()) < 3 * 86_400_000, "next visit ~3 months later");

  const reopened = await post(`/api/maintenance/preventive/${overdueId}/reopen`, { reason: "HA check incomplete" });
  assert.equal(reopened.status, 200);
  assert.equal((reopened.json as { item: { status: string } }).item.status, "In Progress");

  const history = await api(`/api/activities?entityType=preventive&entityId=${overdueId}`, {}, adminCookie);
  const cats = (history.json as { items: Array<{ category: string }> }).items.map((a) => a.category);
  for (const expectedCat of ["Visit Scheduled", "Overdue", "Completed", "Next Visit", "Reopened"]) {
    assert.ok(cats.includes(expectedCat), `missing ${expectedCat}: ${cats.join(", ")}`);
  }

  for (const id of [overdueId, soonId, next.id]) {
    assert.equal((await api(`/api/maintenance/preventive/${id}`, { method: "DELETE" }, adminCookie)).status, 200);
  }
});
