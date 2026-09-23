"use server";
import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { firmAccess, firmSettings } from "@/lib/access";
import { db } from "@/lib/supabase/server";
import { toInstant } from "./dates";
import { detectMime, MAX_FILE_BYTES, safeFilename } from "./files";

export type ActionState = { ok: boolean; message: string };
const uuid = z.uuid();
const title = z.string().trim().min(1).max(180);
const text = (f: FormData, key: string) => String(f.get(key) ?? "");
const id = (f: FormData, key: string) => uuid.parse(text(f, key));
const integer = (f: FormData, key: string) =>
  z.coerce.number().int().positive().parse(text(f, key));
const isoDay = z.iso.date();
const empty: ActionState = { ok: true, message: "Cambios guardados." };
function failure(error: unknown): ActionState {
  unstable_rethrow(error);
  if (error instanceof z.ZodError)
    return {
      ok: false,
      message: "Revisa los campos: hay datos incompletos o inválidos.",
    };
  const e = error as { code?: string; message?: string };
  const messages: Record<string, string> = {
    "42501": "Tu cuenta no tiene permiso para esta operación.",
    "40001":
      "El registro cambió. Recarga la página antes de intentarlo otra vez.",
    "55000": "El registro está archivado o ya no admite esta operación.",
    "23503": "El cliente, responsable o asunto no pertenece a este despacho.",
    "23514": "Revisa los datos, las fechas y el estado del registro.",
    "23502": "Completa todos los datos requeridos.",
    "23505": "El registro ya existe o el resultado ya fue registrado.",
    P0002: "El registro no está disponible.",
  };
  if (e.message === "INVALID_DATE")
    return {
      ok: false,
      message:
        "La fecha no es válida o es ambigua en la zona horaria del despacho.",
    };
  return {
    ok: false,
    message:
      messages[e.code ?? ""] ??
      "No se completó la operación. Intenta de nuevo; si subías un archivo, revisa las cargas pendientes.",
  };
}
async function command(
  form: FormData,
  operation: string,
  args: Record<string, unknown>,
  navigate?: (result: string, firm: string) => string,
): Promise<ActionState> {
  const firm = id(form, "firm");
  const { client } = await firmAccess(firm);
  const { data, error } = await client.rpc(operation, {
    p_firm: firm,
    ...args,
  });
  if (error) throw error;
  revalidatePath("/app", "layout");
  if (navigate) redirect(navigate(String(data), firm));
  return empty;
}
export async function login(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const email = z.email().max(254).parse(text(form, "email").trim());
    const password = z.string().min(1).max(256).parse(text(form, "password"));
    const client = await db();
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error)
      return {
        ok: false,
        message:
          "No se pudo iniciar sesión. Revisa tus datos o espera un momento antes de reintentar.",
      };
    redirect("/app");
  } catch (error) {
    return failure(error);
  }
}
export async function logout() {
  const client = await db();
  const { error } = await client.auth.signOut({ scope: "local" });
  if (error) throw new Error("No se pudo cerrar sesión. Intenta nuevamente.");
  revalidatePath("/app", "layout");
  redirect("/login");
}
export async function saveClient(_: ActionState, f: FormData) {
  try {
    return await command(
      f,
      "save_client",
      {
        p_id: text(f, "client") ? id(f, "client") : null,
        p_name: title.max(160).parse(text(f, "name")),
        p_email: z
          .union([z.email(), z.literal("")])
          .parse(text(f, "email").trim()),
        p_phone: z.string().trim().max(40).parse(text(f, "phone")),
        p_channel: z
          .enum(["WHATSAPP", "PHONE", "REFERRAL", "WALK_IN", "OTHER"])
          .parse(text(f, "channel")),
      },
      (result, firm) => `/app/${firm}/clients/${result}`,
    );
  } catch (e) {
    return failure(e);
  }
}
export async function createMatter(_: ActionState, f: FormData) {
  try {
    return await command(
      f,
      "create_matter",
      {
        p_client: id(f, "client"),
        p_responsible: id(f, "responsible"),
        p_title: title.parse(text(f, "title")),
        p_description: z.string().max(5000).parse(text(f, "description")),
      },
      (result, firm) => `/app/${firm}/matters/${result}`,
    );
  } catch (e) {
    return failure(e);
  }
}
export async function archiveMatter(_: ActionState, f: FormData) {
  try {
    return await command(f, "set_matter_archived", {
      p_matter: id(f, "matter"),
      p_archived:
        z.enum(["true", "false"]).parse(text(f, "archived")) === "true",
    });
  } catch (e) {
    return failure(e);
  }
}
export async function addEvent(_: ActionState, f: FormData) {
  try {
    const settings = await firmSettings(id(f, "firm"));
    return await command(f, "add_event", {
      p_matter: id(f, "matter"),
      p_title: title.parse(text(f, "title")),
      p_kind: z
        .enum(["HEARING", "DILIGENCE", "FILING", "REVIEW"])
        .parse(text(f, "kind")),
      p_starts_at: toInstant(text(f, "starts_at"), settings.timezone),
      p_location: z.string().max(300).parse(text(f, "location")),
    });
  } catch (e) {
    return failure(e);
  }
}
export async function rescheduleEvent(_: ActionState, f: FormData) {
  try {
    const settings = await firmSettings(id(f, "firm"));
    return await command(f, "reschedule_event", {
      p_event: id(f, "event"),
      p_version: integer(f, "version"),
      p_starts_at: toInstant(text(f, "starts_at"), settings.timezone),
      p_reason: z.string().trim().min(1).max(1000).parse(text(f, "reason")),
    });
  } catch (e) {
    return failure(e);
  }
}
export async function cancelEvent(_: ActionState, f: FormData) {
  try {
    return await command(f, "cancel_event", {
      p_event: id(f, "event"),
      p_version: integer(f, "version"),
    });
  } catch (e) {
    return failure(e);
  }
}
export async function addTask(_: ActionState, f: FormData) {
  try {
    return await command(f, "add_task", {
      p_matter: id(f, "matter"),
      p_title: title.parse(text(f, "title")),
      p_due_on: isoDay.parse(text(f, "due_on")),
    });
  } catch (e) {
    return failure(e);
  }
}
export async function closeTask(_: ActionState, f: FormData) {
  try {
    return await command(f, "close_task", {
      p_task: id(f, "task"),
      p_status: z.enum(["DONE", "CANCELLED"]).parse(text(f, "status")),
    });
  } catch (e) {
    return failure(e);
  }
}
export async function recordMovement(_: ActionState, f: FormData) {
  try {
    const settings = await firmSettings(id(f, "firm"));
    const next = text(f, "next_title").trim(),
      due = text(f, "next_due");
    if (Boolean(next) !== Boolean(due))
      return {
        ok: false,
        message:
          "Para crear el siguiente pendiente indica su descripción y fecha.",
      };
    return await command(f, "record_movement", {
      p_matter: id(f, "matter"),
      p_event: text(f, "event") ? id(f, "event") : null,
      p_occurred_at: toInstant(text(f, "occurred_at"), settings.timezone),
      p_notes: z.string().trim().min(1).max(10000).parse(text(f, "notes")),
      p_next_title: next ? title.parse(next) : null,
      p_next_due: due ? isoDay.parse(due) : null,
    });
  } catch (e) {
    return failure(e);
  }
}
export async function uploadDocument(
  _: ActionState,
  f: FormData,
): Promise<ActionState> {
  try {
    const firm = id(f, "firm"),
      matter = id(f, "matter");
    const { client } = await firmAccess(firm);
    const file = f.get("file");
    if (!(file instanceof File) || !file.size || file.size > MAX_FILE_BYTES)
      return {
        ok: false,
        message: "Selecciona un PDF o imagen de hasta 10 MB.",
      };
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mime = detectMime(bytes);
    if (!mime || (file.type && file.type !== mime))
      return {
        ok: false,
        message:
          "El contenido no corresponde a un PDF, JPEG, PNG o WebP válido.",
      };
    const reservation = await client.rpc("reserve_document", {
      p_firm: firm,
      p_matter: matter,
      p_name: safeFilename(file.name),
      p_mime: mime,
      p_size: file.size,
    });
    if (reservation.error) throw reservation.error;
    const documentId = String(reservation.data);
    const upload = await client.storage
      .from("legal-documents")
      .upload(`${firm}/${matter}/${documentId}`, bytes, {
        contentType: mime,
        upsert: false,
      });
    revalidatePath("/app", "layout");
    if (upload.error)
      return {
        ok: false,
        message:
          "La carga no terminó. Puedes descartar su registro pendiente y volver a subir el archivo.",
      };
    const finish = await client.rpc("finish_document", {
      p_firm: firm,
      p_document: documentId,
    });
    if (finish.error)
      return {
        ok: false,
        message:
          "El archivo se recibió, pero falta confirmar la carga. Usa «Confirmar carga» en documentos.",
      };
    revalidatePath("/app", "layout");
    return { ok: true, message: "Documento guardado con acceso privado." };
  } catch (e) {
    return failure(e);
  }
}
export async function finishDocument(_: ActionState, f: FormData) {
  try {
    return await command(f, "finish_document", {
      p_document: id(f, "document"),
    });
  } catch (e) {
    return failure(e);
  }
}
export async function cancelDocument(_: ActionState, f: FormData) {
  try {
    return await command(f, "cancel_document", {
      p_document: id(f, "document"),
    });
  } catch (e) {
    return failure(e);
  }
}
