"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SignInButton, useAuth, useUser } from "@clerk/nextjs";
import {
  AlertTriangle,
  Archive,
  ArrowRight,
  Clock,
  FolderKanban,
  Loader2,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X
} from "lucide-react";
import {
  ApiClientError,
  archiveProject,
  deleteProject,
  listProjects,
  restoreProject
} from "@/lib/api-client";
import type { Project, ProjectStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate } from "@/lib/format";

const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

function MarketingPage() {
  return (
    <section className="marketing-shell relative min-h-screen overflow-hidden px-5 py-5 sm:px-8 lg:px-10">
      <div className="mx-auto flex min-h-[calc(100vh-2.5rem)] w-full max-w-[1500px] flex-col">
        <nav className="page-enter flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <Image
              src="/brand/helix-icon.svg"
              alt="Helix icon"
              width={40}
              height={40}
              className="rounded-xl"
              priority
              unoptimized
            />
            <span className="text-sm font-semibold uppercase tracking-[0.22em] text-ink">
              Helix
            </span>
          </div>
          {clerkEnabled ? (
            <SignInButton mode="modal">
              <button className="hidden min-h-10 items-center gap-2 rounded-md border border-white/10 bg-white/[0.045] px-4 text-sm font-semibold text-ink transition hover:border-white/20 hover:bg-white/[0.075] sm:inline-flex">
                Sign in
              </button>
            </SignInButton>
          ) : null}
        </nav>

        <div className="grid flex-1 items-center gap-12 py-14 lg:grid-cols-[minmax(0,0.92fr)_minmax(560px,1.08fr)] lg:py-8">
          <div className="page-enter max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand">Helix</p>
            <h1 className="mt-5 max-w-4xl text-5xl font-semibold tracking-normal text-ink sm:text-7xl lg:text-[6.8rem] lg:leading-[0.92]">
              Build product ideas into real plans.
            </h1>
            <p className="mt-7 max-w-2xl text-base leading-8 text-muted sm:text-lg">
              Turn rough ideas into requirements, user flows, UI surfaces, backend services,
              databases, APIs, architecture, roadmap, and export-ready build packs.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              {clerkEnabled ? (
                <SignInButton mode="modal">
                  <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-ink px-6 text-sm font-semibold text-slate-950 transition hover:-translate-y-0.5 hover:bg-white">
                    Get started
                    <ArrowRight size={18} aria-hidden="true" />
                  </button>
                </SignInButton>
              ) : (
                <button className="inline-flex min-h-12 cursor-not-allowed items-center justify-center gap-2 rounded-md border border-line bg-white/6 px-6 text-sm font-semibold text-muted">
                  Add Clerk keys to start
                </button>
              )}
              <span className="text-sm text-muted">
                Private workspace. Product to architecture.
              </span>
            </div>
          </div>

          <div className="page-enter relative hidden min-h-[620px] lg:block">
            <div className="absolute inset-y-8 left-0 right-[-9vw] rounded-l-[2rem] border border-white/10 bg-white/[0.025] shadow-[0_40px_120px_rgba(0,0,0,0.32)] backdrop-blur-2xl" />
            <div className="absolute inset-y-0 left-10 right-0">
              <div className="absolute left-[13%] top-[8%] h-12 w-12 rounded-xl border border-white/10 bg-[#0a0d12] p-2 shadow-2xl">
                <Image src="/brand/helix-icon.svg" alt="" width={32} height={32} unoptimized />
              </div>
              <div className="architecture-line architecture-line-a" />
              <div className="architecture-line architecture-line-b" />
              <div className="architecture-line architecture-line-c" />

              <div className="preview-node preview-node-primary left-[5%] top-[34%] w-[330px]">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">
                  Product map
                </p>
                <p className="mt-3 text-lg font-semibold text-ink">Idea to build plan</p>
                <p className="mt-2 text-sm leading-6 text-muted">
                  Requirements, flows, surfaces, APIs, and roadmap in one run.
                </p>
              </div>
              <div className="preview-node left-[48%] top-[18%] w-[300px]">
                <p className="text-sm font-semibold text-ink">Workspace output</p>
                <div className="mt-4 space-y-3">
                  <span className="block h-2 w-11/12 rounded-full bg-white/12" />
                  <span className="block h-2 w-7/12 rounded-full bg-white/12" />
                  <span className="block h-2 w-9/12 rounded-full bg-white/12" />
                </div>
              </div>
              <div className="preview-node left-[54%] top-[51%] w-[340px]">
                <p className="text-sm font-semibold text-ink">Build map</p>
                <div className="mt-5 grid grid-cols-3 gap-3">
                  {["UI", "API", "DB", "Jobs", "Auth", "Export"].map((item) => (
                    <span
                      key={item}
                      className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-center text-xs text-muted"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
              <div className="preview-node left-[20%] top-[72%] w-[285px]">
                <p className="text-sm font-semibold text-ink">Launch path</p>
                <div className="mt-4 flex items-center gap-2">
                  <span className="h-2 flex-1 rounded-full bg-emerald-300/70" />
                  <span className="text-xs font-semibold text-emerald-200">92</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-line bg-white/5 px-4 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-ink">{value}</p>
    </div>
  );
}

function DeleteProjectDialog({
  project,
  busy,
  onClose,
  onConfirm
}: {
  project: Project | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    if (!project) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [busy, onClose, project]);

  if (!project) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/62 px-4 backdrop-blur-md"
      role="presentation"
      onMouseDown={() => {
        if (!busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-project-title"
        className="page-enter w-full max-w-lg overflow-hidden rounded-lg border border-white/14 bg-[#181a21] shadow-[0_36px_120px_rgba(0,0,0,0.62)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
          <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-red-300/25 bg-red-500/12 text-red-200">
              <AlertTriangle size={20} aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-200">
                Delete project
              </p>
              <h2 id="delete-project-title" className="mt-1 text-xl font-semibold text-ink">
                Remove "{project.name}"?
              </h2>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close delete confirmation"
            disabled={busy}
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-muted transition hover:border-white/20 hover:text-ink disabled:cursor-not-allowed disabled:opacity-45"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <p className="text-sm leading-6 text-slate-300">
            This will permanently delete the project and every design session attached to it. This
            action cannot be undone.
          </p>
          <div className="rounded-md border border-white/10 bg-black/22 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Project</p>
            <p className="mt-2 text-sm font-semibold text-ink">{project.name}</p>
            <p className="mt-1 line-clamp-2 text-sm text-muted">
              {project.description || "No description provided."}
            </p>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-white/10 bg-black/18 p-5 sm:flex-row sm:justify-end">
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            icon={busy ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? "Deleting" : "Delete project"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ProjectsWorkspace() {
  const { isLoaded, isSignedIn } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [status, setStatus] = useState<ProjectStatus | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyProjectId, setBusyProjectId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);

  const query = useMemo(
    () => ({
      page: 1,
      limit: 30,
      sortBy: "updatedAt" as const,
      sortOrder: "desc" as const,
      status: status === "ALL" ? undefined : status,
      search: search.trim() || undefined
    }),
    [search, status]
  );

  async function loadProjects() {
    if (!isLoaded || !isSignedIn) return;
    setLoading(true);
    setError(null);

    try {
      const response = await listProjects(query);
      setProjects(response.projects);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Projects could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProjects();
  }, [isLoaded, isSignedIn, query]);

  async function changeArchiveState(project: Project) {
    setBusyProjectId(project.id);
    setError(null);

    try {
      if (project.status === "ACTIVE") {
        await archiveProject(project.id);
      } else {
        await restoreProject(project.id);
      }
      await loadProjects();
    } catch (caught) {
      const message =
        caught instanceof ApiClientError ? caught.message : "Project status could not be changed.";
      setError(message);
    } finally {
      setBusyProjectId(null);
    }
  }

  async function removeProject(project: Project) {
    setBusyProjectId(project.id);
    setError(null);

    try {
      await deleteProject(project.id);
      setDeleteTarget(null);
      await loadProjects();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Project could not be deleted.");
    } finally {
      setBusyProjectId(null);
    }
  }

  const activeProjects = projects.filter((project) => project.status === "ACTIVE").length;
  const archivedProjects = projects.filter((project) => project.status === "ARCHIVED").length;

  return (
    <div className="page-enter mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <section className="grid gap-5 lg:grid-cols-[1fr_240px] lg:items-end">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.06] px-3 py-1 text-sm font-medium text-ink">
            <FolderKanban size={14} aria-hidden="true" />
            My projects
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-normal text-ink sm:text-5xl">
            AI product builder
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
            Your private Helix portfolio for product ideas, build plans, diagrams, and launch work.
          </p>
        </div>
        <Button href="/projects/new" icon={<Plus size={18} />} className="min-h-12">
          New project
        </Button>
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatPill label="Total projects" value={projects.length} />
        <StatPill label="Active" value={activeProjects} />
        <StatPill label="Archived" value={archivedProjects} />
      </div>

      <Card className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
        <label className="field flex min-h-11 flex-1 items-center gap-3 rounded-md px-3">
          <Search size={17} className="text-muted" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search projects"
            className="w-full border-0 bg-transparent text-sm outline-none placeholder:text-muted/70"
          />
        </label>
        <div className="grid grid-cols-3 gap-2 md:w-auto">
          {(["ALL", "ACTIVE", "ARCHIVED"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setStatus(option)}
              className={`min-h-11 rounded-md border px-3 text-sm font-medium transition ${
                status === option
                  ? "border-white/30 bg-white/[0.1] text-ink"
                  : "border-line bg-white/5 text-muted hover:border-white/20 hover:text-ink"
              }`}
            >
              {option === "ALL" ? "All" : option.toLowerCase()}
            </button>
          ))}
        </div>
      </Card>

      {error ? <ErrorState message={error} onRetry={loadProjects} /> : null}
      {loading ? <LoadingState label="Loading projects" /> : null}

      {!loading && projects.length === 0 ? (
        <EmptyState
          title="No projects yet"
          description="Create the first project to generate a product workspace."
          action={
            <Button href="/projects/new" icon={<Plus size={18} />}>
              Create project
            </Button>
          }
        />
      ) : null}

      <div className="space-y-3">
        {projects.map((project) => (
          <Card key={project.id} className="interactive-card p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <Link href={`/projects/${project.id}`} className="min-w-0 flex-1">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-line bg-black/25 text-sm font-semibold text-brand">
                    {project.name.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-ink">{project.name}</h2>
                      <StatusBadge status={project.status} />
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted">
                      {project.description || "No description provided."}
                    </p>
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
                      <Clock size={13} aria-hidden="true" />
                      Updated {formatDate(project.updatedAt)}
                    </p>
                  </div>
                </div>
              </Link>
              <div className="flex shrink-0 gap-2">
                <Button
                  variant="secondary"
                  icon={
                    project.status === "ACTIVE" ? <Archive size={16} /> : <RotateCcw size={16} />
                  }
                  disabled={busyProjectId === project.id}
                  onClick={() => void changeArchiveState(project)}
                >
                  {project.status === "ACTIVE" ? "Archive" : "Restore"}
                </Button>
                <Button
                  variant="danger"
                  icon={<Trash2 size={16} />}
                  disabled={busyProjectId === project.id}
                  onClick={() => setDeleteTarget(project)}
                >
                  Delete
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <DeleteProjectDialog
        project={deleteTarget}
        busy={deleteTarget ? busyProjectId === deleteTarget.id : false}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) void removeProject(deleteTarget);
        }}
      />
    </div>
  );
}

export default function HomePage() {
  if (!clerkEnabled) {
    return <MarketingPage />;
  }

  return <AuthenticatedHome />;
}

function AuthenticatedHome() {
  const { isLoaded, isSignedIn } = useUser();

  if (!isLoaded) {
    return <MarketingPage />;
  }

  return isSignedIn ? <ProjectsWorkspace /> : <MarketingPage />;
}
