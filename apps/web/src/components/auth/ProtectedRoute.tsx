import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { LoginForm } from "./LoginForm";
import { RegisterForm } from "./RegisterForm";
import { FileText, Loader2, Users } from "lucide-react";

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { isAuthenticated, isLoading } = useAuth();
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  const isAuthPage = path === "/login" || path === "/register";
  const isKnownPath = path === "/" || isAuthPage;
  const [authMode, setAuthMode] = useState<"login" | "register">(
    path === "/register" ? "register" : "login",
  );

  useEffect(() => {
    if (isAuthenticated && isAuthPage) {
      window.location.replace("/");
    }
  }, [isAuthenticated, isAuthPage]);

  if (!isKnownPath) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-100">
        <section className="w-full max-w-lg">
          <p className="text-sm text-emerald-300">404 · page not found</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">
            We couldn’t find that page.
          </h1>
          <p className="mt-3 leading-7 text-slate-300">
            The link may be out of date, or the page may have moved.
          </p>
          <a
            href="/"
            className="mt-7 inline-flex rounded-lg bg-white px-5 py-3 font-medium text-slate-950 transition hover:bg-slate-200"
          >
            Back to workspace
          </a>
        </section>
      </main>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          <p className="text-sm font-medium text-slate-500">
            Loading your workspace...
          </p>
        </div>
      </div>
    );
  }

  if (isAuthenticated && isAuthPage) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
        Taking you to your workspace…
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="grid min-h-screen bg-slate-50 lg:grid-cols-2">
        <section className="relative hidden overflow-hidden bg-slate-950 px-12 py-14 text-white lg:flex lg:flex-col lg:justify-between xl:px-20">
          <div className="absolute -right-28 -top-32 h-96 w-96 rounded-full bg-emerald-500/20 blur-3xl" />
          <div className="relative flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-500 font-bold">
              CW
            </div>
            <span className="font-semibold tracking-tight">
              Collaborative Workspace
            </span>
          </div>
          <div className="relative max-w-xl py-16">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300">
              Work together, clearly
            </p>
            <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">
              Your team’s ideas, all in one place.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-slate-300">
              Create shared pages, collaborate as you write, and keep important
              conversations close to the work.
            </p>
            <div className="mt-10 grid gap-4 text-sm text-slate-200 sm:grid-cols-2">
              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
                <FileText className="text-emerald-300" size={19} />
                Shared pages
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
                <Users className="text-emerald-300" size={19} />
                Team access
              </div>
            </div>
          </div>
          <p className="relative text-xs text-slate-400">
            A calmer place to think and build together.
          </p>
        </section>
        <section className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-8">
          <div className="w-full max-w-md">
            <div className="mb-6 flex items-center justify-center gap-3 lg:hidden">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-700 text-sm font-bold text-white">
                CW
              </div>
              <span className="font-semibold text-slate-900">
                Collaborative Workspace
              </span>
            </div>
            {authMode === "login" ? (
              <LoginForm onSwitchToRegister={() => setAuthMode("register")} />
            ) : (
              <RegisterForm onSwitchToLogin={() => setAuthMode("login")} />
            )}
          </div>
        </section>
      </div>
    );
  }

  return <>{children}</>;
};
