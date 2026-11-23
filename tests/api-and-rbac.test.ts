import assert from "node:assert/strict";
import test from "node:test";

const BASE_URL = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";

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

async function loginAs(email: string, password = "virtus123"): Promise<string> {
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

test("RBAC enforcement across Viewer, Field Engineer, and Super Admin", async () => {
  const viewerCookie = await loginAs("marcus@virtusms.io");
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

  const engineerCookie = await loginAs("jamal@virtusms.io");
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

  const adminCookie = await loginAs("iona@virtusms.io");
  const cleanup = await api(
    `/api/maintenance/corrective/${createdId}`,
    { method: "DELETE" },
    adminCookie
  );
  assert.equal(cleanup.status, 200);
});

test("All modules CRUD, Comments, Event Reminder Alerting & Reporting CSV flow", async () => {
  const adminCookie = await loginAs("iona@virtusms.io");

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
        unitPriceUsd: 900,
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
        monthlyFeeUsd: 1200,
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
        dealValueUsd: 5000,
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
