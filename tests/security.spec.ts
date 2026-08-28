import { test, expect } from "@playwright/test";
import { apiClient, BASE_URL, devLoginCookie, expectErrorCode } from "./helpers";

// Admin-only guards, checked at the API level (not through the UI), against
// the real running server — the same property the old Vitest router tests
// checked with a mocked database, now verified end to end.
//
// This project's DashboardLayout auto-redirects to the dev-login bypass
// whenever a browser has no session, so "no session" can't be observed
// through the UI locally — it always ends up logged in as the owner. These
// checks go straight at the tRPC endpoints with a plain client instead,
// where no cookie is ever attached.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("sem sessão", () => {
  const anon = apiClient();

  test("editorial.manage.* exige sessão", async () => {
    await expectErrorCode(anon.editorial.manage.list.query(), "UNAUTHORIZED");
    await expectErrorCode(anon.editorial.manage.create.mutate({ title: "x" }), "UNAUTHORIZED");
    await expectErrorCode(anon.editorial.manage.createCategory.mutate({ name: "Teste", kind: "tipo" }), "UNAUTHORIZED");
  });

  test("gallery.manage.* exige sessão", async () => {
    await expectErrorCode(anon.gallery.manage.save.mutate({ images: [] }), "UNAUTHORIZED");
  });

  test("magazine.manage.* exige sessão", async () => {
    await expectErrorCode(anon.magazine.manage.delete.mutate({ id: 999999 }), "UNAUTHORIZED");
  });

  test("as rotas de upload da revista exigem sessão", async () => {
    const chunk = await fetch(`${BASE_URL}/api/magazine/upload-chunk?uploadId=x&index=0`, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: new Uint8Array([1, 2, 3]),
    });
    expect(chunk.status).toBe(401);

    const finalize = await fetch(`${BASE_URL}/api/magazine/finalize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chunkKeys: ["x"], title: "x", fileName: "x.pdf" }),
    });
    expect(finalize.status).toBe(401);
  });

  test("as leituras públicas continuam acessíveis", async () => {
    await expect(anon.editorial.latest.query({ limit: 3 })).resolves.toBeInstanceOf(Array);
    await expect(anon.gallery.list.query()).resolves.toBeInstanceOf(Array);
    await expect(anon.magazine.list.query()).resolves.toBeInstanceOf(Array);
  });
});

test.describe("sessão autenticada, mas não administradora", () => {
  test("não pode criar categorias", async () => {
    const client = apiClient(await devLoginCookie("user"));
    await expectErrorCode(client.editorial.manage.createCategory.mutate({ name: "Teste", kind: "tipo" }), "FORBIDDEN");
  });

  test("não pode gerir a galeria do site", async () => {
    const client = apiClient(await devLoginCookie("user"));
    await expectErrorCode(client.gallery.manage.save.mutate({ images: [] }), "FORBIDDEN");
  });

  test("não pode gerir a revista", async () => {
    const client = apiClient(await devLoginCookie("user"));
    await expectErrorCode(client.magazine.manage.delete.mutate({ id: 999999 }), "FORBIDDEN");
  });

  test("não pode carregar partes de PDF para a revista", async () => {
    const cookie = await devLoginCookie("user");
    const resp = await fetch(`${BASE_URL}/api/magazine/upload-chunk?uploadId=x&index=0`, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream", cookie },
      body: new Uint8Array([1, 2, 3]),
    });
    expect(resp.status).toBe(403);
  });

  test("continua a poder criar o seu próprio rascunho de artigo", async () => {
    // manage.create não é restrito a administradores — qualquer sessão pode
    // rascunhar; só publicar/gerir taxonomias/multimédia/revista é que exige admin.
    const client = apiClient(await devLoginCookie("user"));
    const created = await client.editorial.manage.create.mutate({ title: `[E2E] rascunho utilizador ${Date.now()}` });
    expect(created?.id).toBeTruthy();
    if (created) await apiClient(await devLoginCookie("admin")).editorial.manage.deleteDraft.mutate({ id: created.id });
  });
});
