import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { BrandKit } from "@gaa/shared";
import { getClientProfile, updateClientSettings } from "@/lib/db/clients";
import { logAction } from "@/lib/db/audit";
import { handleRouteError, jsonError } from "@/lib/http";

export const runtime = "nodejs";

/** Editable design-language + render settings. Both optional → patch only what's sent. */
const Body = z.object({
  brand_kit: BrandKit.optional(),
  use_ai_backgrounds: z.boolean().optional(),
});

/** PATCH /api/clients/:id — update the brand kit (design language) and/or the
 *  AI-background preference, before generating/rendering variants. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return jsonError(400, "Invalid settings payload");
    }
    if (!(await getClientProfile(params.id))) {
      return jsonError(404, "Client not found");
    }
    const updated = await updateClientSettings(params.id, parsed.data);
    await logAction({
      action: "client.settings_updated",
      clientId: params.id,
      details: {
        brand_kit: parsed.data.brand_kit !== undefined,
        use_ai_backgrounds: parsed.data.use_ai_backgrounds,
      },
    });
    return NextResponse.json({ client: updated });
  } catch (err) {
    return handleRouteError("api/clients/:id PATCH", err);
  }
}
