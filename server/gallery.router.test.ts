import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const db = vi.hoisted(() => ({
  listSiteGalleryImages: vi.fn(),
  replaceSiteGalleryImages: vi.fn(),
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

describe("site gallery router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists the site gallery publicly without authentication", async () => {
    db.listSiteGalleryImages.mockResolvedValue([{ id: 1, url: "/manus-storage/a.jpg", altText: null, caption: null, position: 0 }]);
    const caller = appRouter.createCaller({ user: null, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] });

    await expect(caller.gallery.list()).resolves.toEqual([{ id: 1, url: "/manus-storage/a.jpg", altText: null, caption: null, position: 0 }]);
  });

  it("rejects a non-admin user from saving the site gallery", async () => {
    const caller = appRouter.createCaller(createContext(12, "user"));

    await expect(caller.gallery.manage.save({ images: [] })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.replaceSiteGalleryImages).not.toHaveBeenCalled();
  });

  it("allows an administrator to replace the site gallery", async () => {
    db.listSiteGalleryImages.mockResolvedValue([]);
    const caller = appRouter.createCaller(createContext(1, "admin"));
    const images = [{ url: "/manus-storage/a.jpg", storageKey: "a.jpg", altText: null, caption: null, position: 0 }];

    await caller.gallery.manage.save({ images });

    expect(db.replaceSiteGalleryImages).toHaveBeenCalledWith(images);
  });

  it("rejects more than 100 images in a single save", async () => {
    const caller = appRouter.createCaller(createContext(1, "admin"));
    const images = Array.from({ length: 101 }, (_, index) => ({ url: `/manus-storage/${index}.jpg`, position: index % 100 }));

    await expect(caller.gallery.manage.save({ images })).rejects.toThrow();
    expect(db.replaceSiteGalleryImages).not.toHaveBeenCalled();
  });
});
