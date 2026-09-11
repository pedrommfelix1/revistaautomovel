import { TRPCError } from "@trpc/server";
import { getAnalyticsSummary } from "../db";
import { protectedProcedure, router } from "../_core/trpc";

// Pageview/click tracking itself is a plain POST /api/track (see
// server/_core/analytics.ts) — a tRPC mutation would need a hook-bound
// client, but the tracking calls fire from route-change effects and raw
// onClick handlers outside any query context, so navigator.sendBeacon /
// fetch against a plain endpoint is the simpler fit. Only the admin-only
// summary read goes through tRPC, where a component-bound query is natural.
export const analyticsRouter = router({
  summary: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Apenas administradores podem ver as métricas." });
    }
    return getAnalyticsSummary();
  }),
});
