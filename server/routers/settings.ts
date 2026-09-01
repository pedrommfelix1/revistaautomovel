import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSiteSettings, updateSiteSettings } from "../db";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";

type SettingsContext = { user: { role: "admin" | "user" } };

function assertCanManageSettings(ctx: SettingsContext) {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Apenas administradores podem editar as definições do site." });
  }
}

const homeSettingsInput = z.object({
  homeKicker: z.string().max(160).nullable(),
  homeHeadline: z.string().max(400).nullable(),
  homeSubtitle: z.string().max(400).nullable(),
});

export const settingsRouter = router({
  home: publicProcedure.query(() => getSiteSettings()),

  manage: router({
    saveHome: protectedProcedure.input(homeSettingsInput).mutation(async ({ ctx, input }) => {
      assertCanManageSettings(ctx);
      return updateSiteSettings(input);
    }),
  }),
});
