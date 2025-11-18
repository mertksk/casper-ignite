'use client';

import { useState } from "react";
import { Button } from "../ui/button";

interface ApproveButtonProps {
  projectId: string;
  projectTitle: string;
}

export function ApproveButton({ projectId, projectTitle }: ApproveButtonProps) {
  const [isApproving, setIsApproving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleApprove() {
    if (!confirm(`Approve "${projectTitle}" for main market?`)) {
      return;
    }

    setIsApproving(true);
    setMessage(null);

    try {
      // In production, this would get the admin wallet from Casper Wallet
      const adminWallet = "admin-wallet-0x0000"; // Placeholder

      const response = await fetch(`/api/admin/projects/${projectId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminWallet }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to approve project");
      }

      setMessage("✅ Project approved successfully!");

      // Refresh the page after 2 seconds
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      setMessage(
        `❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setIsApproving(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        onClick={handleApprove}
        disabled={isApproving}
        className="rounded-lg bg-green-600 px-6 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
      >
        {isApproving ? "Approving..." : "Approve Project"}
      </Button>
      {message && (
        <p className="text-xs font-medium text-brand-700">{message}</p>
      )}
    </div>
  );
}
