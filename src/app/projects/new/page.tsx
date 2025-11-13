import { Metadata } from "next";
import { ProjectCreateForm } from "@/components/projects/project-create-form";

export const metadata: Metadata = {
  title: "Yeni Proje",
  description: "Casper Ignite üzerinde yeni bir tokenize proje oluşturun.",
};

export default function NewProjectPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-brand-800">Proje Oluştur</h1>
        <p className="text-brand-600">
          Token arzı, sahiplik yüzdesi ve kurucu cüzdanı belirleyerek projeni dakikalar içinde
          yayına al.
        </p>
      </div>
      <ProjectCreateForm />
    </div>
  );
}
