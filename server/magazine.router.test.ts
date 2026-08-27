import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const db = vi.hoisted(() => ({
  listMagazineIssues: vi.fn(),
  getMagazineIssue: vi.fn(),
  deleteMagazineIssue: vi.fn(),
}));

vi.mock("./db", () => db);

import { appRouter } from "./routers";

function createContext(userId: number, role: "admin" | "user"): TrpcContext {
  return {
    user: {
      id: userId,
      openId: `author-${userId}`,
      name: "Autor de teste",
      email: "autor@example.com",
      loginMethod: "manus",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as TrpcContext["res"],
  };
}

describe("magazine router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists magazine issues publicly without authentication", async () => {
    db.listMagazineIssues.mockResolvedValue([{ id: 1, title: "N.º 01", pdfUrl: "/manus-storage/a.pdf", coverImageUrl: null }]);
    const caller = appRouter.createCaller({ user: null, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] });

    await expect(caller.magazine.list()).resolves.toEqual([{ id: 1, title: "N.º 01", pdfUrl: "/manus-storage/a.pdf", coverImageUrl: null }]);
  });

  it("rejects a non-admin user from deleting an issue", async () => {
    const caller = appRouter.createCaller(createContext(12, "user"));

    await expect(caller.magazine.manage.delete({ id: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.deleteMagazineIssue).not.toHaveBeenCalled();
  });

  it("allows an administrator to delete an issue", async () => {
    const caller = appRouter.createCaller(createContext(1, "admin"));

    await caller.magazine.manage.delete({ id: 5 });

    expect(db.deleteMagazineIssue).toHaveBeenCalledWith(5);
  });

  it("rejects a cover image that isn't a valid base64 data URL", async () => {
    const caller = appRouter.createCaller(createContext(1, "admin"));

    await expect(caller.magazine.manage.uploadCover({ dataUrl: "not-a-data-url", fileName: "capa.jpg" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
