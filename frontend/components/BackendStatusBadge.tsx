"use client";

import { useEffect, useState } from "react";
import { checkBackendHealth, ApiHealthState } from "@/lib/api";
import { RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";

export function BackendStatusBadge() {
  const [health, setHealth] = useState<ApiHealthState>({
    isHealthy: false,
    data: null,
    error: null,
    checkedAt: "",
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchStatus = async () => {
    setIsLoading(true);
    const result = await checkBackendHealth();
    setHealth(result);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchStatus();
    // Poll health periodically every 30 seconds
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-2 text-xs font-mono">
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-colors ${
          isLoading
            ? "bg-stone-100 text-stone-600 border-stone-200"
            : health.isHealthy
            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
            : "bg-amber-50 text-amber-800 border-amber-200"
        }`}
        title={
          health.isHealthy
            ? `API v${health.data?.version} (${health.data?.environment}) connected`
            : health.error || "Cannot reach backend at /api/v1/health"
        }
      >
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            isLoading
              ? "bg-stone-400 animate-pulse"
              : health.isHealthy
              ? "bg-emerald-500"
              : "bg-amber-500"
          }`}
        />
        <span className="font-sans text-xs font-medium">
          {isLoading
            ? "Checking API..."
            : health.isHealthy
            ? `Backend v${health.data?.version || "0.1"}`
            : "Backend Offline"}
        </span>
      </div>

      <button
        onClick={fetchStatus}
        disabled={isLoading}
        aria-label="Refresh API Health"
        className="p-1 text-stone-400 hover:text-stone-700 disabled:opacity-50 transition-colors"
        title="Check backend status now"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
      </button>
    </div>
  );
}
