import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
process.loadEnvFile(".env.test.local");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!["127.0.0.1", "localhost"].includes(new URL(url).hostname))
  throw new Error("Integration tests require an isolated LOCAL database.");
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const anonymous = createClient(url, key, options),
  a = createClient(url, key, options),
  lawyer = createClient(url, key, options),
  b = createClient(url, key, options);
// Fixture administration stays in the disposable local PostgreSQL container.
// Never broaden application/service-role grants to make this test pass.
const projectId = readFileSync("supabase/config.toml", "utf8").match(
  /^project_id\s*=\s*"([A-Za-z0-9_-]+)"/m,
)?.[1];
if (!projectId) throw new Error("Missing local project id");
function setLawyerActive(active) {
  assert.equal(typeof active, "boolean");
  const sql = `update public.profiles set is_active=${active ? "true" : "false"} where id='00000000-0000-4000-a000-000000000102' returning id;`;
  const output = execFileSync(
    "docker",
    [
      "exec",
      `supabase_db_${projectId}`,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      sql,
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  assert.ok(output.includes("00000000-0000-4000-a000-000000000102"));
}
const A = "10000000-0000-4000-a000-000000000001",
  B = "10000000-0000-4000-a000-000000000002";
const MA = "40000000-0000-4000-a000-000000000001",
  MB = "40000000-0000-4000-a000-000000000002";
const PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n",
);
const rpc = async (client, name, args) => {
  const r = await client.rpc(name, args);
  assert.equal(r.error, null, r.error?.message);
  return r.data;
};
const denied = (result) =>
  assert.ok(result.error, "Expected an authorization or validation error");
let documentId, path, matterId, eventId;
before(async () => {
  for (const [client, email] of [
    [a, "admin.a@calce.test"],
    [lawyer, "lawyer.a@calce.test"],
    [b, "admin.b@calce.test"],
  ]) {
    const r = await client.auth.signInWithPassword({
      email,
      password: "CalceDemo!2026",
    });
    assert.equal(r.error, null, r.error?.message);
    assert.ok(r.data.session);
  }
});
after(() => setLawyerActive(true));
test("invalid password and anonymous business access are rejected", async () => {
  denied(
    await anonymous.auth.signInWithPassword({
      email: "admin.a@calce.test",
      password: "incorrect-password",
    }),
  );
  denied(await anonymous.from("clients").select("*"));
});
test("enabling email login does not enable public registration", async () => {
  const result = await anonymous.auth.signUp({
    email: `uninvited-${randomUUID()}@calce.test`,
    password: "CalceDemo!2026",
  });
  assert.equal(result.error?.code, "signup_disabled");
  assert.equal(result.data.session, null);
});
test("authenticated REST and RPC enforce tenant boundaries", async () => {
  const r = await lawyer.from("matters").select("*");
  assert.equal(r.error, null);
  assert.ok(r.data.some((m) => m.id === MA));
  assert.ok(r.data.every((m) => m.firm_id === A));
  denied(
    await b.rpc("save_client", {
      p_firm: A,
      p_name: "Forbidden",
      p_email: "",
      p_phone: "",
      p_channel: "PHONE",
    }),
  );
  denied(
    await a.from("firm_memberships").update({ role: "ADMIN" }).eq("firm_id", B),
  );
  assert.deepEqual((await a.from("matters").select("*").eq("id", MB)).data, []);
});
test("client and matter can be created with normal user identity", async () => {
  const clientId = await rpc(a, "save_client", {
    p_firm: A,
    p_name: "HTTP " + randomUUID(),
    p_email: "",
    p_phone: "",
    p_channel: "WHATSAPP",
  });
  matterId = await rpc(a, "create_matter", {
    p_firm: A,
    p_client: clientId,
    p_responsible: "20000000-0000-4000-a000-000000000102",
    p_title: "HTTP workflow",
    p_description: "",
  });
  assert.equal(
    (
      await lawyer
        .from("matters")
        .select("client_id")
        .eq("id", matterId)
        .single()
    ).data.client_id,
    clientId,
  );
});
test("document reservation requires open same-firm matter and bounded size", async () => {
  denied(
    await a.rpc("reserve_document", {
      p_firm: A,
      p_matter: MB,
      p_name: "wrong.pdf",
      p_mime: "application/pdf",
      p_size: PDF.length,
    }),
  );
  denied(
    await a.rpc("reserve_document", {
      p_firm: A,
      p_matter: matterId,
      p_name: "large.pdf",
      p_mime: "application/pdf",
      p_size: 10485761,
    }),
  );
  documentId = await rpc(a, "reserve_document", {
    p_firm: A,
    p_matter: matterId,
    p_name: "evidence.pdf",
    p_mime: "application/pdf",
    p_size: PDF.length,
  });
  path = `${A}/${matterId}/${documentId}`;
});
test("unreserved, foreign, and another users upload paths are denied", async () => {
  denied(
    await a.storage
      .from("legal-documents")
      .upload(`${A}/${matterId}/${randomUUID()}`, PDF, {
        contentType: "application/pdf",
      }),
  );
  denied(
    await b.storage
      .from("legal-documents")
      .upload(path, PDF, { contentType: "application/pdf" }),
  );
  denied(
    await lawyer.storage
      .from("legal-documents")
      .upload(path, PDF, { contentType: "application/pdf" }),
  );
  denied(await a.rpc("finish_document", { p_firm: A, p_document: documentId }));
});
test("bytes remain unreadable until the owner confirms a successful upload", async () => {
  const uploaded = await a.storage
    .from("legal-documents")
    .upload(path, PDF, { contentType: "application/pdf", upsert: false });
  assert.equal(uploaded.error, null, uploaded.error?.message);
  denied(await a.storage.from("legal-documents").download(path));
  denied(
    await lawyer.rpc("finish_document", { p_firm: A, p_document: documentId }),
  );
  await rpc(a, "finish_document", { p_firm: A, p_document: documentId });
  await rpc(a, "finish_document", { p_firm: A, p_document: documentId }); // safe retry
});
test("same-firm lawyers download exact bytes, while foreign and anonymous users cannot", async () => {
  const r = await lawyer.storage.from("legal-documents").download(path);
  assert.equal(r.error, null, r.error?.message);
  assert.deepEqual(Buffer.from(await r.data.arrayBuffer()), PDF);
  denied(await b.storage.from("legal-documents").download(path));
  denied(await b.storage.from("legal-documents").createSignedUrl(path, 60));
  denied(await anonymous.storage.from("legal-documents").download(path));
  assert.deepEqual(
    (await b.from("documents").select("*").eq("id", documentId)).data,
    [],
  );
  const publicUrl = a.storage.from("legal-documents").getPublicUrl(path)
    .data.publicUrl;
  assert.notEqual((await fetch(publicUrl)).status, 200);
});
test("a stored object cannot be overwritten or deleted by application users", async () => {
  denied(
    await a.storage
      .from("legal-documents")
      .upload(path, PDF, { contentType: "application/pdf", upsert: true }),
  );
  await a.storage.from("legal-documents").remove([path]);
  const r = await a.storage.from("legal-documents").download(path);
  assert.equal(r.error, null);
  assert.deepEqual(Buffer.from(await r.data.arrayBuffer()), PDF);
});
test("revocation blocks private bytes and writes with the existing access token", async () => {
  setLawyerActive(false);
  try {
    denied(await lawyer.storage.from("legal-documents").download(path));
    denied(
      await lawyer.rpc("add_task", {
        p_firm: A,
        p_matter: matterId,
        p_title: "Revoked",
        p_due_on: "2026-12-01",
      }),
    );
  } finally {
    setLawyerActive(true);
  }
});
test("concurrent outcomes produce one movement and one next task", async () => {
  eventId = await rpc(a, "add_event", {
    p_firm: A,
    p_matter: matterId,
    p_title: "Concurrent hearing",
    p_kind: "HEARING",
    p_starts_at: new Date(Date.now() - 86400000).toISOString(),
    p_location: "",
  });
  const args = {
    p_firm: A,
    p_matter: matterId,
    p_occurred_at: new Date(Date.now() - 60000).toISOString(),
    p_notes: "Outcome",
    p_event: eventId,
    p_next_title: "Unique next task",
    p_next_due: "2026-12-01",
  };
  const results = await Promise.all([
    a.rpc("record_movement", args),
    lawyer.rpc("record_movement", args),
  ]);
  assert.equal(results.filter((r) => !r.error).length, 1);
  assert.equal(results.filter((r) => r.error?.code === "40001").length, 1);
  assert.equal(
    (await a.from("movements").select("id").eq("event_id", eventId)).data
      .length,
    1,
  );
  assert.equal(
    (
      await a
        .from("tasks")
        .select("id")
        .eq("matter_id", matterId)
        .eq("title", "Unique next task")
    ).data.length,
    1,
  );
});
test("archiving blocks new work but preserves private downloads and history", async () => {
  await rpc(a, "set_matter_archived", {
    p_firm: A,
    p_matter: matterId,
    p_archived: true,
  });
  denied(
    await a.rpc("add_task", {
      p_firm: A,
      p_matter: matterId,
      p_title: "Blocked",
      p_due_on: "2026-12-01",
    }),
  );
  assert.equal(
    (await a.storage.from("legal-documents").download(path)).error,
    null,
  );
  assert.equal(
    (await a.from("movements").select("id").eq("event_id", eventId)).data
      .length,
    1,
  );
  await rpc(a, "set_matter_archived", {
    p_firm: A,
    p_matter: matterId,
    p_archived: false,
  });
});
test("metadata cannot confirm a file with a different actual size", async () => {
  const doc = await rpc(a, "reserve_document", {
    p_firm: A,
    p_matter: matterId,
    p_name: "mismatch.pdf",
    p_mime: "application/pdf",
    p_size: PDF.length + 1,
  });
  const object = `${A}/${matterId}/${doc}`;
  assert.equal(
    (
      await a.storage
        .from("legal-documents")
        .upload(object, PDF, { contentType: "application/pdf" })
    ).error,
    null,
  );
  denied(await a.rpc("finish_document", { p_firm: A, p_document: doc }));
  await rpc(a, "cancel_document", { p_firm: A, p_document: doc });
  denied(await a.storage.from("legal-documents").download(object));
});
