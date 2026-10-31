import Link from "next/link";
import { db } from "@/lib/db";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const users = await db.user.count();
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Welcome back</h1>
      <p className="mt-1.5 text-sm text-slate-500">Sign in to your workspace to continue.</p>
      <LoginForm next={next ?? ""} />
      {users === 0 && (
        <p className="mt-6 text-center text-sm text-slate-500">
          First time here?{" "}
          <Link href="/register" className="font-medium text-brand-600 hover:text-brand-700">
            Create your workspace
          </Link>
        </p>
      )}
    </>
  );
}
