import { type NextRequest } from "next/server";
import { getCreativeRenderData } from "@/lib/db/creatives";
import { renderDisplayResponse } from "@/lib/render/render";
import { isDisplaySize } from "@/lib/render/sizes";
import { jsonError } from "@/lib/http";

// next/og + bundled fonts require the Node.js runtime.
export const runtime = "nodejs";

/**
 * GET /api/creatives/:id/render?size=300x250 — render a Display creative to PNG.
 * Search creatives have no canvas (RSA assets are assembled, not rendered).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const size = req.nextUrl.searchParams.get("size") ?? "1200x628";
  if (!isDisplaySize(size)) {
    return jsonError(400, `Unknown size "${size}"`);
  }

  try {
    const data = await getCreativeRenderData(params.id);
    if (!data) return jsonError(404, "Creative not found");
    if (data.spec.format !== "display") {
      return jsonError(409, "Only Display creatives are rendered to images");
    }
    return await renderDisplayResponse(data.spec, data.brandKit, size, data.allowAi);
  } catch (err) {
    console.error("[api/creatives/:id/render]", err);
    return jsonError(500, "Failed to render creative");
  }
}
