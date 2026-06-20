import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { TextInput } from "@/components/ui";

export default async function LoginPage({ searchParams }: { searchParams: { error?: string } }) {
  const user = await getCurrentUser();
  if (user) redirect(user.role === Role.ADMIN ? "/admin" : "/team");

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-md rounded-lg border border-line bg-white p-6 shadow-panel">
        <div className="text-sm font-semibold uppercase tracking-wide text-brand">Operations Portal</div>
        <h1 className="mt-2 text-2xl font-semibold text-ink">Sign in</h1>
        {searchParams.error ? <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">Invalid email or password.</div> : null}
        <form action="/api/auth/login" method="post" className="mt-6 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-ink">Email</span>
            <TextInput name="email" type="email" required className="mt-1" />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-ink">Password</span>
            <TextInput name="password" type="password" required className="mt-1" />
          </label>
          <button className="focus-ring h-10 w-full rounded-md bg-brand text-sm font-semibold text-white hover:bg-[#12564C]">Sign in</button>
        </form>
      </div>
    </main>
  );
}
