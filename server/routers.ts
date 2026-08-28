import { COOKIE_NAME } from "../shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { editorialRouter } from "./routers/editorial";
import { galleryRouter } from "./routers/gallery";
import { magazineRouter } from "./routers/magazine";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    // Strip passwordHash — auth.me is a publicProcedure, so this is the one
    // place ctx.user reaches the client. Never send the hash out, even
    // though it's not the plaintext password.
    me: publicProcedure.query(({ ctx }) => {
      if (!ctx.user) return null;
      const { passwordHash: _passwordHash, ...safeUser } = ctx.user;
      return safeUser;
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  editorial: editorialRouter,
  gallery: galleryRouter,
  magazine: magazineRouter,
});

export type AppRouter = typeof appRouter;
