import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth-server";
import { ProjectReviewerLab } from "@/components/project-reviewer/project-reviewer-lab";

export const metadata: Metadata = {
  title: "Project Reviewer Lab",
  description:
    "Review a project submission with AI-scored feedback across structure, naming, accessibility and performance.",
};

export default async function ProjectReviewerLabPage() {
  const user = await requireUser();
  if (!user) redirect("/sign-in?redirect=/labs/project-reviewer");

  return <ProjectReviewerLab userName={user.name} />;
}
