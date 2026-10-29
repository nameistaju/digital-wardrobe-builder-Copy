"use client";

import { useState } from "react";
import { X, Sparkles, LogIn, UserPlus, Zap, Check } from "lucide-react";
import { loginUser, registerUser, demoLogin, User } from "@/lib/api";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: User) => void;
}

export function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (isRegister) {
        const res = await registerUser(email, password, fullName || undefined);
        onSuccess(res.user);
        onClose();
      } else {
        const res = await loginUser(email, password);
        onSuccess(res.user);
        onClose();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await demoLogin();
      onSuccess(res.user);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Demo sign in failed.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        className="fixed inset-0 bg-stone-900/50 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="relative z-10 w-full max-w-md bg-[#faf8f5] rounded-3xl border border-stone-200 p-6 sm:p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-stone-200">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-stone-900 text-stone-50 font-serif text-sm font-bold">
              W
            </span>
            <h2 className="text-xl font-semibold text-stone-950 font-serif">
              {isRegister ? "Create Wardrobe Account" : "Welcome Back"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-900 hover:bg-stone-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Demo Fast Login Button */}
        <div className="py-4 border-b border-stone-200">
          <button
            type="button"
            onClick={handleDemoLogin}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-sm font-medium border border-stone-300 transition-all shadow-xs"
          >
            <Zap className="w-4 h-4 text-amber-600 fill-amber-500" />
            <span>Instant Demo Sign In (Evaluator Mode)</span>
          </button>
          <p className="text-[11px] text-stone-500 text-center mt-1.5 font-mono">
            Zero setup required • Private local sandbox account
          </p>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {isRegister && (
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">
                Full Name (Optional)
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Elena Rostova"
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-stone-900 text-sm focus:border-stone-900 focus:ring-1 focus:ring-stone-900 transition-colors"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="curator@wardrobe.app"
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-stone-900 text-sm focus:border-stone-900 focus:ring-1 focus:ring-stone-900 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">
              Password
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-stone-900 text-sm focus:border-stone-900 focus:ring-1 focus:ring-stone-900 transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-stone-900 text-stone-50 text-sm font-medium hover:bg-stone-800 active:scale-[0.99] disabled:opacity-50 transition-all shadow-sm"
          >
            {isLoading ? (
              <span className="inline-block w-4 h-4 border-2 border-stone-50 border-t-transparent rounded-full animate-spin" />
            ) : isRegister ? (
              <>
                <UserPlus className="w-4 h-4" />
                <span>Create Account</span>
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>Sign In</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-5 pt-4 border-t border-stone-200 text-center">
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setError(null);
            }}
            className="text-xs text-stone-600 hover:text-stone-950 underline underline-offset-4"
          >
            {isRegister
              ? "Already have an account? Sign in"
              : "Don't have an account yet? Create one"}
          </button>
        </div>
      </div>
    </div>
  );
}
