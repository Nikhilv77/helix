"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Clock, Layers3, Plus } from "lucide-react";
import { getProject, listProjectDesignSessions } from "@/lib/api-client";
import type { DesignSession, Project } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate } from "@/lib/format";

interface ProjectDetailsPageProps {
  params: Promise<{
    projectId: string;
  }>;
}

export default function ProjectDetailsPage({ params }: ProjectDetailsPageProps) {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [sessions, setSessions] = useState<DesignSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void params.then((resolved) => setProjectId(resolved.projectId));
  }, [params]);

  async function loadProject(id: string) {
    setLoading(true);
    setError(null);

    try {
      const [projectResponse, sessionsResponse] = await Promise.all([
        getProject(id),
        listProjectDesignSessions(id)
      ]);
      setProject(projectResponse);
      setSessions(sessionsResponse);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Project could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (projectId) {
      void loadProject(projectId);
    }
  }, [projectId]);

  if (!projectId || loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <LoadingState label="Loading project" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <ErrorState message={error} onRetry={() => loadProject(projectId)} />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <EmptyState title="Project unavailable" description="The project could not be found." />
      </div>
    );
  }

  const canCreateSession = project.status === "ACTIVE";

  return (
    <div className="page-enter mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button href="/" variant="ghost" icon={<ArrowLeft size={16} />}>
            Back to projects
          </Button>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-normal text-ink">{project.name}</h1>
            <StatusBadge status={project.status} />
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
            {project.description || "No project description provided."}
          </p>
        </div>
        <Button
          href={`/projects/${project.id}/sessions/new`}
          icon={<Plus size={18} />}
          className={canCreateSession ? "" : "pointer-events-none opacity-55"}
        >
          New session
        </Button>
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
            <Layers3 size={17} className="text-brand" aria-hidden="true" />
            Design sessions
          </h2>
          <p className="text-sm text-muted">{sessions.length} total</p>
        </div>
        {!canCreateSession ? (
          <p className="mt-3 rounded-md border border-amber-300/25 bg-amber-400/10 px-3 py-2 text-sm text-amber-200">
            Archived projects cannot receive new design sessions.
          </p>
        ) : null}
        <div className="mt-5">
          {sessions.length === 0 ? (
            <EmptyState
              title="No design sessions"
              description="Create a session with a problem statement to begin the copilot flow."
              action={
                canCreateSession ? (
                  <Button href={`/projects/${project.id}/sessions/new`} icon={<Plus size={18} />}>
                    Create session
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="grid gap-3">
              {sessions.map((session) => (
                <Link key={session.id} href={`/design-sessions/${session.id}`}>
                  <div className="interactive-card rounded-md border border-line bg-white/5 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <h3 className="text-sm font-semibold text-ink">{session.title}</h3>
                      <StatusBadge status={session.status} />
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted">
                      {session.problemStatement}
                    </p>
                    <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
                      <Clock size={13} aria-hidden="true" />
                      Updated {formatDate(session.updatedAt)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
