'use client';

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useState } from "react";
import { ProjectCreateInput, projectCreateSchema } from "@/lib/dto";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader } from "../ui/card";

export function ProjectCreateForm() {
  const form = useForm<ProjectCreateInput>({
    resolver: zodResolver(projectCreateSchema),
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

  async function onSubmit(values: ProjectCreateInput) {
    setMessage(null);
    const response = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!response.ok) {
      setMessage("Project could not be saved. Please verify the form fields.");
      return;
    }
    setMessage("Project created! Token deployment has been kicked off.");
    form.reset();
  }

  return (
    <Card className="border-4 border-brand-100 bg-white/90 shadow-cartoon-pop">
      <CardHeader>
        <p className="text-base font-semibold text-brand-700">Create a New Project</p>
        <p className="text-sm text-brand-600">
          Enter your title, description, and token parameters to open a crowdfunding listing on
          Casper Ignite.
        </p>
        <div className="mt-3 rounded-lg border-2 border-brand-300 bg-brand-50 p-3">
          <p className="text-sm font-semibold text-brand-700">💰 Listing Fee: 2000 CSPR</p>
          <p className="text-xs text-brand-600">
            600 CSPR platform fee, 1400 CSPR initial liquidity pool
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <Input placeholder="Project title" {...form.register("title")} />
          <Textarea
            placeholder="Project description"
            rows={4}
            {...form.register("description")}
          />
          <div className="grid gap-4 md:grid-cols-3">
            <Input placeholder="Token symbol" {...form.register("tokenSymbol")} />
            <Input
              type="number"
              placeholder="Token supply"
              {...form.register("tokenSupply", { valueAsNumber: true })}
            />
            <Input
              type="number"
              placeholder="Ownership %"
              {...form.register("ownershipPercent", { valueAsNumber: true })}
            />
          </div>
          <Input placeholder="Founder wallet address" {...form.register("creatorAddress")} />

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
            disabled={form.formState.isSubmitting}
            className="rounded-full bg-brand-500 text-white shadow-cartoon-pop hover:bg-brand-400"
          >
            {form.formState.isSubmitting ? "Submitting..." : "Publish Project (2000 CSPR Required)"}
          </Button>
          {message && <p className="text-sm font-semibold text-brand-600">{message}</p>}
        </form>
      </CardContent>
    </Card>
  );
}
