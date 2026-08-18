import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";

export const metadata = { title: "Log in · AshVault" };

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
