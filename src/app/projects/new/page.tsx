import { Metadata } from "next";
import { ProjectCreateForm } from "@/components/projects/project-create-form";

export const metadata: Metadata = {
  title: "New Project",
  description: "Create a new tokenized project on Casper Ignite.",
};

export default function NewProjectPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-brand-800">Launch a Project</h1>
        <p className="text-brand-600">
          Set token supply, ownership share, and founder wallet to go live in minutes.
        </p>
      </div>
      <ProjectCreateForm />
    </div>
  );
}
