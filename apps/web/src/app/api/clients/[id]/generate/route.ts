import { NextResponse, type NextRequest } from "next/server";
import { getClientProfile } from "@/lib/db/clients";
import { getLatestAnalysis } from "@/lib/db/analyses";
import { saveCreatives } from "@/lib/db/creatives";
import { generateVariants, AiServiceError } from "@/lib/ai/client";
import { logAction } from "@/lib/db/audit";
import { handleRouteError, jsonError } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 180;

/** POST /api/clients/:id/generate — generate variants from the latest analysis. */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const client = await getClientProfile(params.id);
    if (!client) return jsonError(404, "Client not found");

    const analysis = await getLatestAnalysis(params.id);
    if (!analysis) {
      return jsonError(409, "Run competitor analysis before generating variants.");
    }

    const result = await generateVariants(client, analysis);
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
