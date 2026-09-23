import { addProject, listProjects } from "@/lib/store";
import type { PerceptionMode } from "@/lib/pipeline";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q") ?? "";
  const projects = await listProjects(query);
  return Response.json({ orgId: "org_northline", projects });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    name?: string;
    source?: PerceptionMode;
    ir?: unknown;
  };
  const source = body.source ?? "calibrated-sample";
  if (source !== "calibrated-sample" && source !== "captured-plan" && source !== "uploaded-ir") {
    return Response.json({ error: "Unknown review source." }, { status: 400 });
  }
  if (source === "uploaded-ir" && !body.ir) {
    return Response.json({ error: "Upload an IR JSON document first." }, { status: 400 });
  }
  try {
    const project = await addProject(body.name ?? "", source, body.ir);
    return Response.json({ project }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not review that plan.";
    return Response.json({ error: message }, { status: 400 });
  }
}
