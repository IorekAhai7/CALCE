import { Field, Select } from "./fields";
import { channels, type Client } from "@/modules/cases/types";
export function ClientFields({ client }: { client?: Client }) {
  return (
    <>
      <Field
        label="Nombre del cliente"
        name="name"
        required
        maxLength={160}
        defaultValue={client?.name}
      />
      <Field
        label="Correo del cliente"
        name="email"
        type="email"
        maxLength={254}
        defaultValue={client?.email}
      />
      <Field
        label="Teléfono"
        name="phone"
        type="tel"
        maxLength={40}
        defaultValue={client?.phone}
      />
      <Select
        label="Cómo llegó al despacho"
        name="channel"
        defaultValue={client?.channel ?? "WHATSAPP"}
      >
        {Object.entries(channels).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </Select>
    </>
  );
}
