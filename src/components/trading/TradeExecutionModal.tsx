'use client';

import { useState, useEffect } from 'react';
import { useCasperWallet } from '@/hooks/useCasperWallet';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';

type Trade = {
  id: string;
  tokenAmount: number;
  pricePerToken: number;
  totalValue: number;
  buyerWallet: string;
  sellerWallet: string;
  tokenSymbol: string;
  status: string;
  blockchainHash?: string;
};

type DeployParams = {
  deployJson: string;
  deployHash: string;
};

interface TradeExecutionModalProps {
  tradeId: string | null;
  onClose: () => void;
  onComplete: () => void;
}

export function TradeExecutionModal({ tradeId, onClose, onComplete }: TradeExecutionModalProps) {
  const { publicKey, signDeploy } = useCasperWallet();
  const [trade, setTrade] = useState<Trade | null>(null);
  const [deployParams, setDeployParams] = useState<DeployParams | null>(null);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'signing' | 'submitting' | 'confirming' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [deployHash, setDeployHash] = useState<string | null>(null);

  useEffect(() => {
    if (!tradeId) return;

    const loadTradeDetails = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/trades/${tradeId}/execute`);
        if (!response.ok) {
          throw new Error('Failed to load trade details');
        }

        const data = await response.json();
        setTrade(data.trade);
        setDeployParams(data.deployParams);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load trade');
        setStatus('error');
      } finally {
        setLoading(false);
      }
    };

    loadTradeDetails();
  }, [tradeId]);

  const handleExecute = async () => {
    if (!trade || !deployParams || !publicKey) return;

    setExecuting(true);
    setStatus('signing');
    setError(null);

    try {
      // Step 1: Sign the deploy with Casper Wallet
      const signResult = await signDeploy(deployParams.deployJson, publicKey);

      if (signResult.cancelled) {
        setError('Transaction was cancelled');
        setStatus('error');
        setExecuting(false);
        return;
      }

      setStatus('submitting');

      // Step 2: Submit the signed deploy to the blockchain
      const response = await fetch(`/api/trades/${tradeId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signedDeployJson: deployParams.deployJson, // In production, this should be the signed deploy
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit transaction');
      }

      const { deployHash: submittedHash } = await response.json();
      setDeployHash(submittedHash);
      setStatus('confirming');

      // Step 3: Poll for confirmation
      await pollForConfirmation(submittedHash);

      setStatus('success');
      setTimeout(() => {
        onComplete();
        onClose();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transaction failed');
      setStatus('error');
    } finally {
      setExecuting(false);
    }
  };

  const pollForConfirmation = async (hash: string): Promise<void> => {
    const maxAttempts = 24; // 2 minutes (5s interval)
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const response = await fetch(`/api/deploys/${hash}/status`);
        const { executed, success } = await response.json();

        if (executed && success) {
          return;
        }

        if (executed && !success) {
          throw new Error('Transaction execution failed on blockchain');
        }

        await new Promise((resolve) => setTimeout(resolve, 5000));
        attempts++;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        throw new Error(`Failed to check transaction status: ${message}`);
      }
    }

    throw new Error('Transaction confirmation timeout');
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
        </div>
      );
    }

    if (!trade) {
      return (
        <div className="py-8 text-center text-sm text-red-600">
          Failed to load trade details
        </div>
      );
    }

    switch (status) {
      case 'idle':
        return (
          <div className="space-y-6">
            {/* Trade Details */}
            <div className="rounded-lg border-2 border-brand-200 bg-brand-50 p-4">
              <h4 className="mb-3 font-semibold text-brand-800">Trade Details</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-brand-700">Token:</span>
                  <span className="font-semibold text-brand-900">{trade.tokenSymbol}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-brand-700">Amount:</span>
                  <span className="font-semibold text-brand-900">
                    {trade.tokenAmount.toFixed(2)} {trade.tokenSymbol}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-brand-700">Price per token:</span>
                  <span className="font-semibold text-brand-900">
                    {trade.pricePerToken.toFixed(4)} CSPR
                  </span>
                </div>
                <div className="border-t border-brand-300 pt-2">
                  <div className="flex justify-between">
                    <span className="font-semibold text-brand-800">Total Value:</span>
                    <span className="font-bold text-brand-900">
                      {trade.totalValue.toFixed(4)} CSPR
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Counterparty Info */}
            <div className="rounded-lg border border-brand-200 bg-white p-4">
              <h4 className="mb-2 text-sm font-semibold text-brand-800">Transaction Flow</h4>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-brand-600">From (Seller):</span>
                  <span className="flex-1 truncate font-mono text-brand-900">
                    {trade.sellerWallet}
                  </span>
                </div>
                <div className="flex items-center justify-center text-brand-500">→</div>
                <div className="flex items-center gap-2">
                  <span className="text-brand-600">To (Buyer):</span>
                  <span className="flex-1 truncate font-mono text-brand-900">
                    {trade.buyerWallet}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                onClick={onClose}
                variant="outline"
                className="flex-1 rounded-full"
                disabled={executing}
              >
                Cancel
              </Button>
              <Button
                onClick={handleExecute}
                disabled={executing}
                className="flex-1 rounded-full bg-brand-600 text-white hover:bg-brand-700"
              >
                {executing ? 'Processing...' : 'Sign & Execute Trade'}
              </Button>
            </div>
          </div>
        );

      case 'signing':
        return (
          <div className="space-y-4 py-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-100">
              <span className="text-3xl">✍️</span>
            </div>
            <div>
              <h4 className="text-lg font-semibold text-brand-800">Waiting for Signature</h4>
              <p className="mt-2 text-sm text-brand-600">
                Please sign the transaction in your Casper Wallet
              </p>
            </div>
          </div>
        );

      case 'submitting':
        return (
          <div className="space-y-4 py-8 text-center">
            <div className="mx-auto h-16 w-16">
              <div className="h-16 w-16 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
            </div>
            <div>
              <h4 className="text-lg font-semibold text-brand-800">Submitting Transaction</h4>
              <p className="mt-2 text-sm text-brand-600">
                Sending transaction to Casper network...
              </p>
            </div>
          </div>
        );

      case 'confirming':
        return (
          <div className="space-y-4 py-8 text-center">
            <div className="mx-auto h-16 w-16">
              <div className="h-16 w-16 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
            </div>
            <div>
              <h4 className="text-lg font-semibold text-brand-800">Confirming Transaction</h4>
              <p className="mt-2 text-sm text-brand-600">
                Waiting for blockchain confirmation...
              </p>
              {deployHash && (
                <div className="mt-4 rounded-lg border border-brand-200 bg-brand-50 p-3">
                  <p className="text-xs text-brand-700">Transaction Hash:</p>
                  <p className="mt-1 truncate font-mono text-xs text-brand-900">{deployHash}</p>
                </div>
              )}
            </div>
          </div>
        );

      case 'success':
        return (
          <div className="space-y-4 py-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <span className="text-3xl">✅</span>
            </div>
            <div>
              <h4 className="text-lg font-semibold text-green-800">Trade Executed Successfully!</h4>
              <p className="mt-2 text-sm text-brand-600">
                Tokens have been transferred on the blockchain
              </p>
              {deployHash && (
                <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3">
                  <p className="text-xs text-green-700">Transaction Hash:</p>
                  <p className="mt-1 truncate font-mono text-xs text-green-900">{deployHash}</p>
                </div>
              )}
            </div>
          </div>
        );

      case 'error':
        return (
          <div className="space-y-4 py-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <span className="text-3xl">❌</span>
            </div>
            <div>
              <h4 className="text-lg font-semibold text-red-800">Transaction Failed</h4>
              <p className="mt-2 text-sm text-red-600">{error}</p>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={onClose}
                variant="outline"
                className="flex-1 rounded-full"
              >
                Close
              </Button>
              <Button
                onClick={() => {
                  setStatus('idle');
                  setError(null);
                }}
                className="flex-1 rounded-full bg-brand-600 text-white hover:bg-brand-700"
              >
                Try Again
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={!!tradeId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <h3 className="text-xl font-bold text-brand-800">Execute Trade</h3>
        </DialogHeader>
        {renderContent()}
      </DialogContent>
    </Dialog>
  );
}
