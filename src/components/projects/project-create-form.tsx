'use client';

import { publicRuntime } from "@/lib/client-config";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Resolver } from "react-hook-form";
import { useState, useEffect } from "react";
import { ProjectCreateInput, projectCreateSchema } from "@/lib/dto";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader } from "../ui/card";
import { useCasperWallet } from "@/hooks/useCasperWallet";
import { buildTransferDeploy } from "@/lib/casper-client";

type DeploymentStep = 'idle' | 'platform-fee' | 'liquidity-pool' | 'submitting' | 'done';

export function ProjectCreateForm() {
  const { publicKey, isConnected, signDeploy } = useCasperWallet();
  const form = useForm<ProjectCreateInput>({
    resolver: zodResolver(projectCreateSchema) as Resolver<ProjectCreateInput>,
    defaultValues: {
      title: "",
      description: "",
      tokenSymbol: "",
      tokenSupply: 1_000_000,
      ownershipPercent: 10,
      creatorAddress: "",
      category: "OTHER",
      roadmap: "",
      fundingGoal: 10_000,
    },
  });
  const [message, setMessage] = useState<string | null>(null);
  const [deploymentStep, setDeploymentStep] = useState<DeploymentStep>('idle');

  // Auto-fill creator address when wallet is connected
  useEffect(() => {
    if (isConnected && publicKey) {
      form.setValue("creatorAddress", publicKey);
    }
  }, [isConnected, publicKey, form]);

  async function onSubmit(values: ProjectCreateInput) {
    if (!publicKey || !isConnected) {
      setMessage("Please connect your Casper wallet first.");
      return;
    }

    setMessage(null);

    try {
      // Step 1: Platform fee payment (20 CSPR)
      setDeploymentStep('platform-fee');
      setMessage(`Step 1/2: Sending platform fee (${publicRuntime.platformFeeAmount} CSPR)...`);

      const platformFeeDeploy = buildTransferDeploy({
        fromPublicKey: publicKey,
        toPublicKey: publicRuntime.platformFeeAddress,
        amount: (publicRuntime.platformFeeAmount * 1_000_000_000).toString(), // Convert to motes
      });

      const platformFeeSignature = await signDeploy(platformFeeDeploy.deployJson as string);
      if (platformFeeSignature.cancelled) {
        throw new Error(platformFeeSignature.message || "Platform fee payment was cancelled");
      }
      const platformFeeHash = platformFeeDeploy.deployHash;

      // Step 2: Liquidity pool payment (180 CSPR)
      setDeploymentStep('liquidity-pool');
      setMessage(`Step 2/2: Sending liquidity pool (${publicRuntime.liquidityPoolAmount} CSPR)...`);

      const liquidityPoolDeploy = buildTransferDeploy({
        fromPublicKey: publicKey,
        toPublicKey: publicRuntime.liquidityPoolAddress,
        amount: (publicRuntime.liquidityPoolAmount * 1_000_000_000).toString(),
      });

      const liquidityPoolSignature = await signDeploy(liquidityPoolDeploy.deployJson as string);
      if (liquidityPoolSignature.cancelled) {
        throw new Error(liquidityPoolSignature.message || "Liquidity pool payment was cancelled");
      }
      const liquidityPoolHash = liquidityPoolDeploy.deployHash;

      // Step 3: Submit project to backend (platform will deploy token)
      setDeploymentStep('submitting');
      setMessage("Submitting project... Platform is deploying your token and distributing ownership...");

      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          platformFeeHash,
          liquidityPoolHash,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Submission error:", errorData);

        let errorMessage = "Project could not be saved. Please verify the form fields.";

        if (errorData.error) {
          if (typeof errorData.error === 'string') {
            errorMessage = errorData.error;
          } else if (typeof errorData.error === 'object') {
            const fieldErrors = errorData.error.fieldErrors || {};
            const formErrors = errorData.error.formErrors || [];

            const messages = [
              ...formErrors,
              ...Object.entries(fieldErrors).map(([field, msgs]) => `${field}: ${(msgs as string[]).join(', ')}`)
            ];

            if (messages.length > 0) {
              errorMessage = `Validation failed: ${messages.join('; ')}`;
            } else {
              errorMessage = JSON.stringify(errorData.error);
            }
          }
        }

        setMessage(`Error: ${errorMessage}`);
        setDeploymentStep('idle');
        return;
      }

      setDeploymentStep('done');
      setMessage("✅ Project created successfully! Your token is being deployed on Casper blockchain.");
      form.reset();

      // Reset to idle after 5 seconds
      setTimeout(() => {
        setDeploymentStep('idle');
        setMessage(null);
      }, 5000);

    } catch (error) {
      console.error("Deployment error:", error);
      const errorMsg = error instanceof Error ? error.message : "Unknown error occurred";
      setMessage(`Error: ${errorMsg}`);
      setDeploymentStep('idle');
    }
  }

  return (
    <Card className="border-4 border-brand-100 bg-white/90 shadow-cartoon-pop">
      <CardHeader>
        <p className="text-base font-semibold text-brand-700">Create a New Project</p>
        <p className="text-sm text-brand-600">
          Fill in the details below to launch your project.
        </p>
        <div className="mt-3 rounded-lg border-2 border-brand-300 bg-brand-50 p-3">
          <p className="text-sm font-semibold text-brand-700">💰 Listing Fee: {publicRuntime.totalPaymentAmount} CSPR</p>
          <p className="text-xs text-brand-600">
            {publicRuntime.platformFeeAmount} CSPR platform fee, {publicRuntime.liquidityPoolAmount} CSPR initial liquidity pool
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="space-y-2">
            <label className="text-sm font-medium text-brand-700">Project Title</label>
            <Input placeholder="e.g., CasperSwap - Decentralized Exchange" {...form.register("title")} />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-brand-700">Project Description</label>
            <Textarea
              placeholder="Describe your project, its goals, and unique value proposition..."
              rows={4}
              {...form.register("description")}
            />
            <p className="text-xs text-brand-600">Minimum 30 characters</p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-brand-700">Token Symbol</label>
              <Input placeholder="e.g., CSWAP" {...form.register("tokenSymbol")} />
              <p className="text-xs text-brand-600">3-8 uppercase letters/numbers</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-brand-700">Token Supply</label>
              <Input
                type="number"
                placeholder="100000000"
                {...form.register("tokenSupply", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-brand-700">Ownership %</label>
              <Input
                type="number"
                placeholder="15"
                {...form.register("ownershipPercent", { valueAsNumber: true })}
              />
              <p className="text-xs text-brand-600">1-100%</p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-brand-700">Founder Wallet Address</label>
            <Input
              placeholder="Auto-filled when wallet connected"
              {...form.register("creatorAddress")}
              disabled={isConnected}
              className={isConnected ? "bg-green-50 border-green-200" : ""}
            />
            {isConnected && publicKey && (
              <p className="text-xs text-green-600">✓ Connected wallet address auto-filled</p>
            )}
            {!isConnected && (
              <p className="text-xs text-brand-600">Connect your wallet to auto-fill this field</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-brand-700">Project Category</label>
            <select
              {...form.register("category")}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="DEFI">DeFi</option>
              <option value="GAMING">Gaming</option>
              <option value="NFT">NFT</option>
              <option value="DAO">DAO</option>
              <option value="INFRASTRUCTURE">Infrastructure</option>
              <option value="METAVERSE">Metaverse</option>
              <option value="SOCIAL">Social</option>
              <option value="MARKETPLACE">Marketplace</option>
              <option value="TOOLS">Tools</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-brand-700">Roadmap (Milestones)</label>
            <Textarea
              placeholder="Outline your milestones and timeline..."
              rows={6}
              {...form.register("roadmap")}
            />
            <p className="text-xs text-brand-600">
              At least 50 characters. Ex: Q1 2025: Beta launch, Q2 2025: Mainnet...
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-brand-700">Funding Goal (CSPR)</label>
            <Input
              type="number"
              placeholder="10000"
              {...form.register("fundingGoal", { valueAsNumber: true })}
            />
            <p className="text-xs text-brand-600">
              Amount you plan to raise in CSPR (minimum 100 CSPR)
            </p>
          </div>

          <Button
            type="submit"
            disabled={deploymentStep !== 'idle' || !isConnected}
            className="rounded-full bg-brand-500 text-white shadow-cartoon-pop hover:bg-brand-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {deploymentStep !== 'idle' ? "Processing..." : `Publish Project (${publicRuntime.totalPaymentAmount} CSPR Required)`}
          </Button>
          {!isConnected && (
            <p className="text-sm font-semibold text-orange-600">⚠️ Please connect your Casper wallet to publish a project</p>
          )}
          {message && (
            <p className={`text-sm font-semibold ${deploymentStep === 'done' ? 'text-green-600' : 'text-brand-600'}`}>
              {message}
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
