'use client';

import { useState } from 'react';
import { useCasperWallet } from '@/hooks/useCasperWallet';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

type PaymentStep = 'connect' | 'platformFee' | 'liquidity' | 'complete' | 'error';

type PaymentStatus = {
  step: PaymentStep;
  platformFeeHash?: string;
  liquidityPoolHash?: string;
  error?: string;
  processing: boolean;
};

// Import amounts from config - these will be from env variables
const PLATFORM_FEE_AMOUNT = 600; // CSPR (from publicRuntime.platformFeeAmount)
const LIQUIDITY_AMOUNT = 1400; // CSPR (from publicRuntime.liquidityPoolAmount)
// Note: Actual addresses will be fetched from API which reads from server config

interface ProjectPaymentFlowProps {
  onComplete: (platformFeeHash: string, liquidityPoolHash: string) => void;
  onCancel?: () => void;
}

export function ProjectPaymentFlow({ onComplete, onCancel }: ProjectPaymentFlowProps) {
  const { isConnected, publicKey, connect } = useCasperWallet();
  const [status, setStatus] = useState<PaymentStatus>({
    step: isConnected ? 'platformFee' : 'connect',
    processing: false,
  });

  const handleConnect = async () => {
    try {
      setStatus({ ...status, processing: true });
      await connect();
      setStatus({ step: 'platformFee', processing: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to connect wallet';
      setStatus({ step: 'error', error: message, processing: false });
    }
  };

  const handlePlatformFeePayment = async () => {
    if (!publicKey) return;

    setStatus({ ...status, processing: true });

    try {
      // Create CSPR transfer deploy for platform fee
      const response = await fetch('/api/payments/create-transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromPublicKey: publicKey,
          toPublicKey: PLATFORM_FEE_ADDRESS,
          amount: PLATFORM_FEE_AMOUNT,
          purpose: 'platform_fee',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create payment deploy');
      }

      const { deployJson, deployHash } = await response.json();

      // Sign the deploy with Casper Wallet
      const { signDeploy } = await import('@/hooks/useCasperWallet');
      // TODO: This needs to be properly imported from the hook context
      // For now, we'll use a simpler approach

      // Submit signed deploy
      const submitResponse = await fetch('/api/payments/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deployHash,
          signedDeploy: deployJson, // This should be signed
        }),
      });

      if (!submitResponse.ok) {
        throw new Error('Failed to submit payment');
      }

      // Wait for confirmation
      await waitForDeployConfirmation(deployHash);

      setStatus({
        ...status,
        step: 'liquidity',
        platformFeeHash: deployHash,
        processing: false,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Payment failed';
      setStatus({ ...status, step: 'error', error: message, processing: false });
    }
  };

  const handleLiquidityPayment = async () => {
    if (!publicKey) return;

    setStatus({ ...status, processing: true });

    try {
      // Create CSPR transfer deploy for liquidity
      const response = await fetch('/api/payments/create-transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromPublicKey: publicKey,
          toPublicKey: LIQUIDITY_POOL_ADDRESS,
          amount: LIQUIDITY_AMOUNT,
          purpose: 'liquidity_pool',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create payment deploy');
      }

      const { deployJson, deployHash } = await response.json();

      // Sign and submit
      // TODO: Implement proper wallet signing

      // Wait for confirmation
      await waitForDeployConfirmation(deployHash);

      setStatus({
        step: 'complete',
        platformFeeHash: status.platformFeeHash,
        liquidityPoolHash: deployHash,
        processing: false,
      });

      // Notify parent component
      if (status.platformFeeHash) {
        onComplete(status.platformFeeHash, deployHash);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Payment failed';
      setStatus({ ...status, step: 'error', error: message, processing: false });
    }
  };

  const waitForDeployConfirmation = async (deployHash: string): Promise<void> => {
    const maxAttempts = 24; // 2 minutes (5s interval)
    let attempts = 0;

    while (attempts < maxAttempts) {
      const response = await fetch(`/api/deploys/${deployHash}/status`);
      const { executed, success } = await response.json();

      if (executed && success) {
        return;
      }

      if (executed && !success) {
        throw new Error('Deploy execution failed');
      }

      await new Promise((resolve) => setTimeout(resolve, 5000));
      attempts++;
    }

    throw new Error('Deploy confirmation timeout');
  };

  const renderStepContent = () => {
    switch (status.step) {
      case 'connect':
        return (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-100">
              <span className="text-3xl">🔗</span>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-brand-800">Connect Wallet</h3>
              <p className="mt-2 text-sm text-brand-600">
                Connect your Casper Wallet to proceed with project creation payment
              </p>
            </div>
            <Button
              onClick={handleConnect}
              disabled={status.processing}
              className="w-full rounded-full bg-brand-600 py-6 text-white hover:bg-brand-700"
            >
              {status.processing ? 'Connecting...' : 'Connect Casper Wallet'}
            </Button>
          </div>
        );

      case 'platformFee':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-brand-100">
                <span className="text-2xl">1️⃣</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-brand-800">Platform Fee</h3>
                <p className="text-sm text-brand-600">Pay {PLATFORM_FEE_AMOUNT} CSPR platform fee</p>
              </div>
            </div>
            <div className="rounded-xl border-2 border-brand-200 bg-brand-50 p-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-brand-700">Amount:</span>
                  <span className="font-semibold text-brand-900">{PLATFORM_FEE_AMOUNT} CSPR</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-brand-700">Gas fee:</span>
                  <span className="font-mono text-brand-900">~0.1 CSPR</span>
                </div>
                <div className="border-t border-brand-300 pt-2">
                  <div className="flex justify-between">
                    <span className="font-semibold text-brand-800">Total:</span>
                    <span className="font-bold text-brand-900">{PLATFORM_FEE_AMOUNT + 0.1} CSPR</span>
                  </div>
                </div>
              </div>
            </div>
            <Button
              onClick={handlePlatformFeePayment}
              disabled={status.processing}
              className="w-full rounded-full bg-brand-600 py-6 text-white hover:bg-brand-700"
            >
              {status.processing ? 'Processing Payment...' : 'Pay Platform Fee'}
            </Button>
            {onCancel && (
              <Button
                onClick={onCancel}
                variant="outline"
                className="w-full rounded-full"
                disabled={status.processing}
              >
                Cancel
              </Button>
            )}
          </div>
        );

      case 'liquidity':
        return (
          <div className="space-y-4">
            <div className="rounded-lg border-2 border-green-200 bg-green-50 p-3">
              <div className="flex items-center gap-2">
                <span className="text-green-600">✓</span>
                <span className="text-sm font-medium text-green-800">
                  Platform fee paid ({status.platformFeeHash?.slice(0, 8)}...)
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-brand-100">
                <span className="text-2xl">2️⃣</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-brand-800">Liquidity Pool</h3>
                <p className="text-sm text-brand-600">Pay {LIQUIDITY_AMOUNT} CSPR for liquidity</p>
              </div>
            </div>
            <div className="rounded-xl border-2 border-brand-200 bg-brand-50 p-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-brand-700">Amount:</span>
                  <span className="font-semibold text-brand-900">{LIQUIDITY_AMOUNT} CSPR</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-brand-700">Gas fee:</span>
                  <span className="font-mono text-brand-900">~0.1 CSPR</span>
                </div>
                <div className="border-t border-brand-300 pt-2">
                  <div className="flex justify-between">
                    <span className="font-semibold text-brand-800">Total:</span>
                    <span className="font-bold text-brand-900">{LIQUIDITY_AMOUNT + 0.1} CSPR</span>
                  </div>
                </div>
              </div>
            </div>
            <Button
              onClick={handleLiquidityPayment}
              disabled={status.processing}
              className="w-full rounded-full bg-brand-600 py-6 text-white hover:bg-brand-700"
            >
              {status.processing ? 'Processing Payment...' : 'Pay Liquidity Pool'}
            </Button>
          </div>
        );

      case 'complete':
        return (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <span className="text-3xl">✅</span>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-green-800">Payment Complete!</h3>
              <p className="mt-2 text-sm text-brand-600">
                Both payments confirmed. You can now proceed with project creation.
              </p>
            </div>
            <div className="space-y-2 text-left">
              <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                <p className="text-xs text-green-700">Platform Fee</p>
                <p className="font-mono text-xs text-green-900">{status.platformFeeHash}</p>
              </div>
              <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                <p className="text-xs text-green-700">Liquidity Pool</p>
                <p className="font-mono text-xs text-green-900">{status.liquidityPoolHash}</p>
              </div>
            </div>
          </div>
        );

      case 'error':
        return (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <span className="text-3xl">❌</span>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-red-800">Payment Failed</h3>
              <p className="mt-2 text-sm text-red-600">{status.error}</p>
            </div>
            <Button
              onClick={() => setStatus({ step: isConnected ? 'platformFee' : 'connect', processing: false })}
              className="w-full rounded-full bg-brand-600 text-white hover:bg-brand-700"
            >
              Try Again
            </Button>
            {onCancel && (
              <Button onClick={onCancel} variant="outline" className="w-full rounded-full">
                Cancel
              </Button>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Card className="border-2 border-brand-200 bg-white shadow-lg">
      <CardHeader className="border-b border-brand-100">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-brand-800">Project Creation Payment</h2>
            <p className="text-sm text-brand-600">Total: 2000 CSPR (600 fee + 1400 liquidity)</p>
          </div>
          <div className="flex gap-2">
            <div
              className={`h-2 w-2 rounded-full ${
                ['platformFee', 'liquidity', 'complete'].includes(status.step)
                  ? 'bg-green-500'
                  : 'bg-gray-300'
              }`}
            />
            <div
              className={`h-2 w-2 rounded-full ${
                ['liquidity', 'complete'].includes(status.step) ? 'bg-green-500' : 'bg-gray-300'
              }`}
            />
            <div
              className={`h-2 w-2 rounded-full ${
                status.step === 'complete' ? 'bg-green-500' : 'bg-gray-300'
              }`}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">{renderStepContent()}</CardContent>
    </Card>
  );
}
