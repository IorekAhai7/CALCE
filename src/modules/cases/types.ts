import { z } from "zod";
export type Client = {
  id: string;
  firm_id: string;
  name: string;
  email: string;
  phone: string;
  channel: string;
};
export type Matter = {
  id: string;
  firm_id: string;
  client_id: string;
  responsible_id: string;
  title: string;
  description: string;
  status: "OPEN" | "ARCHIVED";
  created_at: string;
};
export type Event = {
  id: string;
  firm_id: string;
  matter_id: string;
  title: string;
  kind: string;
  starts_at: string;
  location: string;
  status: "SCHEDULED" | "RECORDED" | "CANCELLED";
  version: number;
};
export type Task = {
  id: string;
  firm_id: string;
  matter_id: string;
  title: string;
  due_on: string;
  status: "OPEN" | "DONE" | "CANCELLED";
};
export type Movement = {
  id: string;
  matter_id: string;
  event_id: string | null;
  occurred_at: string;
  notes: string;
  created_at: string;
};
export type Document = {
  id: string;
  firm_id: string;
  matter_id: string;
  name: string;
  mime_type: string;
  byte_size: number;
  object_path: string;
  status: "PENDING" | "READY" | "CANCELLED";
  actor_id: string;
  created_at: string;
};
export type EventChange = {
  id: string;
  event_id: string;
  old_starts_at: string;
  new_starts_at: string;
  reason: string;
};
export type TeamMember = { id: string; display_name: string };
export type Settings = {
  timezone: string;
  critical_days: number;
  warning_days: number;
  eod_reminder_enabled: boolean;
  eod_reminder_time: string;
};
export const channels = {
  WHATSAPP: "WhatsApp",
  PHONE: "Teléfono",
  REFERRAL: "Recomendación",
  WALK_IN: "Presencial",
  OTHER: "Otro",
};
export const eventKinds = {
  HEARING: "Audiencia",
  DILIGENCE: "Diligencia",
  FILING: "Promoción",
  REVIEW: "Revisión de expediente",
};
export const states: Record<string, string> = {
  OPEN: "Abierto",
  ARCHIVED: "Archivado",
  SCHEDULED: "Programado",
  RECORDED: "Resultado registrado",
  CANCELLED: "Cancelado",
  DONE: "Completado",
};

export const teamSchema = z.array(
  z.object({ id: z.uuid(), display_name: z.string() }),
);
