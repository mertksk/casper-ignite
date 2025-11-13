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
      setMessage("Proje kaydedilemedi. Form alanlarını kontrol edin.");
      return;
    }
    setMessage("Proje oluşturuldu! Token deploy işlemi başlatıldı.");
    form.reset();
  }

  return (
    <Card className="border-4 border-brand-100 bg-white/90 shadow-cartoon-pop">
      <CardHeader>
        <p className="text-base font-semibold text-brand-700">Yeni Proje Oluştur</p>
        <p className="text-sm text-brand-600">
          Başlık, açıklama ve token parametrelerini girerek Casper Ignite üzerinde kitle fonlama ilanı
          açın.
        </p>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <Input placeholder="Proje başlığı" {...form.register("title")} />
          <Textarea
            placeholder="Proje açıklaması"
            rows={4}
            {...form.register("description")}
          />
          <div className="grid gap-4 md:grid-cols-3">
            <Input placeholder="Token simgesi" {...form.register("tokenSymbol")} />
            <Input
              type="number"
              placeholder="Token arzı"
              {...form.register("tokenSupply", { valueAsNumber: true })}
            />
            <Input
              type="number"
              placeholder="Sahiplik %"
              {...form.register("ownershipPercent", { valueAsNumber: true })}
            />
          </div>
          <Input placeholder="Kurucu cüzdan adresi" {...form.register("creatorAddress")} />
          <Button
            type="submit"
            disabled={form.formState.isSubmitting}
            className="rounded-full bg-brand-500 text-white shadow-cartoon-pop hover:bg-brand-400"
          >
            {form.formState.isSubmitting ? "Oluşturuluyor..." : "Projeyi Yayınla"}
          </Button>
          {message && <p className="text-sm font-semibold text-brand-600">{message}</p>}
        </form>
      </CardContent>
    </Card>
  );
}
