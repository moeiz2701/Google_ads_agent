import { NextResponse, type NextRequest } from "next/server";
import { ClientProfileInput } from "@gaa/shared";
import { createClientProfile, listClientProfiles } from "@/lib/db/clients";
import { logAction } from "@/lib/db/audit";
import { handleRouteError } from "@/lib/http";

export const runtime = "nodejs";

/** GET /api/clients — list all clients for the agency. */
export async function GET() {
  try {
    const clients = await listClientProfiles();
    return NextResponse.json({ clients });
  } catch (err) {
    return handleRouteError("api/clients GET", err);
  }
}

/** POST /api/clients — create a client (Module 1 onboarding). */
export async function POST(req: NextRequest) {
  try {
    const input = ClientProfileInput.parse(await req.json());
    const client = await createClientProfile(input);
    await logAction({
      action: "client.created",
      clientId: client.client_id,
      details: { name: client.name, website: client.website },
    });
    return NextResponse.json({ client }, { status: 201 });
  } catch (err) {
    return handleRouteError("api/clients POST", err);
  }
}
