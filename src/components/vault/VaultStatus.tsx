"use client";

import { useQuery } from "@tanstack/react-query";
import { getVaultStatus, formatCspr } from "@/lib/vault-client";

interface VaultStatusProps {
  className?: string;
  showDetails?: boolean;
}

export function VaultStatus({ className = "", showDetails = false }: VaultStatusProps) {
  const { data: status, isLoading, error } = useQuery({
    queryKey: ["vault-status"],
    queryFn: getVaultStatus,
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 10000,
  });

  if (isLoading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="h-2 w-2 rounded-full bg-gray-400 animate-pulse" />
        <span className="text-sm text-gray-500">Loading vault...</span>
      </div>
    );
  }

  if (error || !status) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="h-2 w-2 rounded-full bg-red-500" />
        <span className="text-sm text-red-500">Vault Error</span>
      </div>
    );
  }

  if (!status.configured) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="h-2 w-2 rounded-full bg-yellow-500" />
        <span className="text-sm text-yellow-600">Vault Not Configured</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="h-2 w-2 rounded-full bg-green-500" />
      <span className="text-sm text-green-600">Vault Active</span>
      {showDetails && status.balance && (
        <span className="text-sm text-gray-500 ml-2">
          ({formatCspr(status.balance.cspr)} CSPR locked)
        </span>
      )}
    </div>
  );
}

export function VaultStatusCard({ className = "" }: { className?: string }) {
  const { data: status, isLoading, error, refetch } = useQuery({
    queryKey: ["vault-status"],
    queryFn: getVaultStatus,
    refetchInterval: 30000,
    staleTime: 10000,
  });

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          Token Vault
        </h3>
        <button
          onClick={() => refetch()}
          className="text-xs text-blue-500 hover:text-blue-600"
          disabled={isLoading}
        >
          {isLoading ? "..." : "Refresh"}
        </button>
      </div>

      {isLoading && (
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
        </div>
      )}

      {error && (
        <div className="text-sm text-red-500">
          Failed to load vault status
        </div>
      )}

      {status && !status.configured && (
        <div className="text-sm text-yellow-600 dark:text-yellow-400">
          Vault contract not configured. Set VAULT_CONTRACT_ACCOUNT_HASH in environment.
        </div>
      )}

      {status && status.configured && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            <span className="text-sm text-green-600 dark:text-green-400">Connected</span>
          </div>

          {status.balance && (
            <div className="text-sm">
              <span className="text-gray-500 dark:text-gray-400">Total Locked: </span>
              <span className="font-mono text-gray-900 dark:text-white">
                {formatCspr(status.balance.cspr)} CSPR
              </span>
            </div>
          )}

          <div className="text-xs text-gray-400 dark:text-gray-500 truncate">
            {status.accountHash}
          </div>

          <div className="text-xs text-gray-400 dark:text-gray-500">
            Network: {status.network}
          </div>
        </div>
      )}
    </div>
  );
}
