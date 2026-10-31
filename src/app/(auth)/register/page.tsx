import { redirect } from "next/navigation";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { RegisterForm } from "./register-form";

export const metadata = { title: "Create workspace" };

export default async function RegisterPage() {
  await connection();
  if ((await db.user.count()) > 0) redirect("/login");
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Create your workspace</h1>
      <p className="mt-1.5 text-sm text-slate-500">You will be the administrator. Add your team after signing in.</p>
      <RegisterForm />
    </>
  );
}
