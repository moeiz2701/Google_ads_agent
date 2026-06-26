import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { DISPLAY_TEMPLATE_IDS } from "@gaa/shared";
import { getClientProfile } from "@/lib/db/clients";
import { getLatestAnalysis } from "@/lib/db/analyses";
import { saveCreatives } from "@/lib/db/creatives";
import { generateVariants, AiServiceError, type GenerateOptions } from "@/lib/ai/client";
import { logAction } from "@/lib/db/audit";
import { handleRouteError, jsonError } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 180;

/** Generation options the UI may send (all optional → current defaults). */
const Options = z.object({
  nPerFormat: z.number().int().min(1).max(10).optional(),
  formats: z.array(z.enum(["search", "display"])).optional(),
  allowedTemplates: z.array(z.enum(DISPLAY_TEMPLATE_IDS)).optional(),
});

/** POST /api/clients/:id/generate — generate variants from the latest analysis. */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const client = await getClientProfile(params.id);
    if (!client) return jsonError(404, "Client not found");

    const analysis = await getLatestAnalysis(params.id);
    if (!analysis) {
      return jsonError(409, "Run competitor analysis before generating variants.");
    }

    // Body is optional; parse defensively so the no-options POST still works.
    const body = await req.json().catch(() => ({}));
    const opts = Options.safeParse(body);
    const options: GenerateOptions = opts.success ? opts.data : {};

    const result = await generateVariants(client, analysis, options);
    const saved = await saveCreatives(client.client_id, result.variants);
    await logAction({
      action: "variants.generated",
      clientId: client.client_id,
      details: { count: saved },
    });
    return NextResponse.json({ count: saved, variants: result.variants }, { status: 201 });
  } catch (err) {
    if (err instanceof AiServiceError) return jsonError(502, err.message);
    return handleRouteError("api/clients/:id/generate", err);
  }
}
