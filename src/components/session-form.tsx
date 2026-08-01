"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Save } from "lucide-react";
import { createDesignSession, setAuthTokenProvider } from "@/lib/api-client";
import { Button } from "./ui/button";
import { ErrorState } from "./ui/error-state";

interface SessionFormProps {
  projectId: string;
}

export function SessionForm({ projectId }: SessionFormProps) {
  const router = useRouter();
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [title, setTitle] = useState("");
  const [problemStatement, setProblemStatement] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      if (!isLoaded || !isSignedIn) {
        setError("Authentication is still getting ready. Try again in a moment.");
        return;
      }

      const token = await getToken();
      if (!token) {
        setError("Authentication is not ready. Refresh and try again.");
        return;
      }

      setAuthTokenProvider(() => getToken());
      const session = await createDesignSession(projectId, {
        title: title.trim(),
        problemStatement: problemStatement.trim()
      });
      router.push(`/design-sessions/${session.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Product build could not be created.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-5">
      {error ? <ErrorState message={error} /> : null}
      <label className="block">
        <span className="text-sm font-medium text-ink">Title</span>
        <input
          required
          minLength={2}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="field mt-2 min-h-11 w-full rounded-md px-3 text-sm outline-none"
          placeholder="Build a notification platform"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-ink">Idea brief</span>
        <textarea
          required
          minLength={20}
          value={problemStatement}
          onChange={(event) => setProblemStatement(event.target.value)}
          className="field mt-2 min-h-56 w-full rounded-md px-3 py-2 text-sm leading-6 outline-none"
          placeholder="Describe users, core workflows, UI needs, integrations, scale, constraints, and any known trade-offs."
        />
      </label>
      <div className="flex justify-end">
        <Button
          type="submit"
          icon={<Save size={16} />}
          disabled={
            !isLoaded ||
            !isSignedIn ||
            saving ||
            title.trim().length < 2 ||
            problemStatement.trim().length < 20
          }
        >
          {saving ? "Creating" : "Create build"}
        </Button>
      </div>
    </form>
  );
}
