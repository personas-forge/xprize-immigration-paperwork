import { getUser } from "@/lib/auth/session";
import { exportUserData } from "@/lib/auth/db";

// "Download my data" (GDPR/CCPA portability). Auth-gated — a user can only export
// THEIR OWN data (keyed on the session uid, never a query param). Streams the
// complete bundle as a JSON file attachment.


export async function GET(): Promise<Response> {
  const user = await getUser();
  if (!user) {
    return Response.json({ error: "Sign in to export your data." }, { status: 401 });
  }
  const data = await exportUserData(user.id);
  const bundle = { exportedAt: new Date().toISOString(), ...data };
  const filename = `immigration-concierge-data-${user.id.slice(0, 8)}.json`;
  return new Response(JSON.stringify(bundle, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
