// Liveness only: this does not claim database or storage readiness.
export function GET() {
  return Response.json(
    { status: "ok", service: "calce", phase: "foundation" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
