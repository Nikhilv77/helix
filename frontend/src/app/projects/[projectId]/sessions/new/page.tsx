"use client";

import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { SessionForm } from "@/components/session-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { getProject } from "@/lib/api-client";
import type { Project } from "@/lib/types";

interface NewSessionPageProps {
  params: Promise<{
    projectId: string;
  }>;
}

export default function NewSessionPage({ params }: NewSessionPageProps) {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void params.then((resolved) => setProjectId(resolved.projectId));
  }, [params]);

  useEffect(() => {
    if (!projectId) return;
    const currentProjectId = projectId;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        setProject(await getProject(currentProjectId));
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Project could not be loaded.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [projectId]);

  if (!projectId || loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <LoadingState label="Loading project" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <ErrorState message={error} />
      </div>
    );
  }

  if (project?.status === "ARCHIVED") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <ErrorState message="Archived projects cannot receive new design sessions. Restore the project first." />
      </div>
    );
  }

  return (
    <div className="page-enter mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <Button href={`/projects/${projectId}`} variant="ghost" icon={<ArrowLeft size={16} />}>
          Back to project
        </Button>
        <h1 className="mt-4 text-3xl font-semibold tracking-normal text-ink">
          Create design session
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          Describe the software system you want designed. More product, scale, and constraint
          context produces better requirement analysis.
        </p>
      </div>
      <Card className="p-5">
        <SessionForm projectId={projectId} />
      </Card>
    </div>
  );
}
