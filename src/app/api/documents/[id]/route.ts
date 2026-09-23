import { NextResponse } from "next/server";
import { z } from "zod";
import { session } from "@/lib/access";
import { safeFilename } from "@/modules/cases/files";
import type { Document } from "@/modules/cases/types";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success)
    return new NextResponse(null, { status: 404 });
  const { client } = await session();
  const { data, error } = await client
    .from("documents")
    .select("*")
    .eq("id", id)
    .eq("status", "READY")
    .maybeSingle<Document>();
  if (error) return new NextResponse(null, { status: 503 });
  if (!data) return new NextResponse(null, { status: 404 });
  const file = await client.storage
    .from("legal-documents")
    .download(data.object_path);
  if (file.error) return new NextResponse(null, { status: 404 });
  const filename = encodeURIComponent(safeFilename(data.name)).replace(
    /['()*]/g,
    (c) => "%" + c.charCodeAt(0).toString(16),
  );
  return new NextResponse(file.data, {
    headers: {
      "Content-Type": data.mime_type,
      "Content-Disposition": `attachment; filename="documento"; filename*=UTF-8''${filename}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
