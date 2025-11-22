"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

interface CopyAddressProps {
  address: string;
  className?: string;
}

export function CopyAddress({ address, className = "" }: CopyAddressProps) {
  const [copied, setCopied] = useState(false);

  const shortenAddress = (addr: string) => {
    if (addr.length <= 16) return addr;
    return `${addr.slice(0, 8)}...${addr.slice(-8)}`;
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className={`group inline-flex items-center gap-2 ${className}`}>
      <code className="text-sm font-mono text-brand-900">
        {shortenAddress(address)}
      </code>
      <button
        onClick={handleCopy}
        className="opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
        title="Copy to clipboard"
      >
        {copied ? (
          <Check className="h-4 w-4 text-green-600" />
        ) : (
          <Copy className="h-4 w-4 text-brand-500 hover:text-brand-700" />
        )}
      </button>
    </div>
  );
}
