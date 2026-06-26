import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { DISPLAY_TEMPLATE_IDS } from "@gaa/shared";
import { updateCreativeTemplate } from "@/lib/db/creatives";
import { logAction } from "@/lib/db/audit";
import { handleRouteError, jsonError } from "@/lib/http";

export const runtime = "nodejs";

const Body = z.object({ template_id: z.enum(DISPLAY_TEMPLATE_IDS) });

/** PATCH /api/creatives/:id — change a Display creative's template (re-renders). */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return jsonError(400, "template_id must be a valid Display template");
    }
    const result = await updateCreativeTemplate(params.id, parsed.data.template_id);
    if (result === "not_found") return jsonError(404, "Creative not found");
    if (result === "not_display") return jsonError(409, "Only Display creatives have a template");

    await logAction({
      action: "creative.template_changed",
      details: { id: params.id, template_id: parsed.data.template_id },
    });
    return NextResponse.json({ ok: true, template_id: parsed.data.template_id });
  } catch (err) {
    return handleRouteError("api/creatives/:id PATCH", err);
  }
}
