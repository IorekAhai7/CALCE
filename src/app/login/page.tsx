import { ActionForm } from "@/components/action-form";
import { Field } from "@/components/fields";
import { login } from "@/modules/cases/actions";
export default function Login() {
  return (
    <main className="login">
      <p className="eyebrow">CALCE ABOGADOS</p>
      <h1>Acceso al despacho</h1>
      <p>Inicia sesión con tu cuenta de trabajo.</p>
      <ActionForm action={login} submit="Entrar">
        <Field
          label="Correo electrónico"
          name="email"
          type="email"
          autoComplete="username"
          required
          maxLength={254}
        />
        <Field
          label="Contraseña"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          maxLength={256}
        />
      </ActionForm>
      <p className="muted">
        Si no tienes acceso, solicita apoyo al administrador del despacho.
      </p>
    </main>
  );
}
