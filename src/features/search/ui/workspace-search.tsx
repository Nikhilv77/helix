"use client";

import { BookOpen, FileQuestion, Loader2, Mic, Search, StickyNote } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type KeyboardEvent as ReactKeyboardEvent, useEffect, useRef, useState } from "react";

import type {
  WorkspaceSearchKind,
  WorkspaceSearchResult
} from "@/features/search/contracts/workspace-search";
import { WORKSPACE_SEARCH_GROUPS } from "@/features/search/contracts/workspace-search";
import { searchWorkspace } from "./workspace-search-client";

export function WorkspaceSearch({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<WorkspaceSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const normalizedQuery = query.trim().toLowerCase();
  const resultsId = mobile ? "workspace-search-results-mobile" : "workspace-search-results-desktop";

  useEffect(() => {
    setOpen(false);
    setQuery("");
    setResults([]);
  }, [pathname]);

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k") return;
      const mobileViewport = window.matchMedia("(max-width: 767px)").matches;
      if (mobileViewport !== mobile) return;
      event.preventDefault();
      setOpen(true);
      inputRef.current?.focus();
    };

    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, [mobile]);

  useEffect(() => {
    if (!normalizedQuery) {
      setResults([]);
      setLoading(false);
      setFailed(false);
      setActiveIndex(0);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setFailed(false);
    const timer = window.setTimeout(() => {
      void searchWorkspace(normalizedQuery, controller.signal)
        .then((response) => {
          setResults(response.results);
          setActiveIndex(0);
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setResults([]);
          setFailed(true);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 180);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [normalizedQuery]);

  useEffect(() => {
    if (!open) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && !searchRef.current?.contains(target)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const chooseResult = (result: WorkspaceSearchResult) => {
    setOpen(false);
    setQuery("");
    setResults([]);
    router.push(result.href);
  };

  const onSearchKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" && results.length) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => (current + 1) % results.length);
      return;
    }
    if (event.key === "ArrowUp" && results.length) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => (current - 1 + results.length) % results.length);
      return;
    }
    if (event.key === "Enter" && open && results[activeIndex]) {
      event.preventDefault();
      chooseResult(results[activeIndex]);
      return;
    }
    if (event.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div
      ref={searchRef}
      className={mobile ? "relative w-[min(14rem,calc(100vw-4.75rem))]" : "relative w-60"}
    >
      <label className="relative block">
        <span className="sr-only">Search workspace</span>
        <Search
          size={15}
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-cream/42"
        />
        <input
          ref={inputRef}
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onKeyDown={onSearchKeyDown}
          placeholder="Search"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open && Boolean(normalizedQuery)}
          aria-controls={resultsId}
          aria-activedescendant={
            results[activeIndex] ? `${resultsId}-${results[activeIndex].id}` : undefined
          }
          className={[
            "w-full border border-white/[0.12] bg-[#17181b] pl-9 pr-3 text-cream outline-none placeholder:text-cream/38 transition hover:border-white/[0.18] hover:bg-[#1b1c20] focus:border-white/[0.12] focus:bg-[#17181b] focus:outline-none focus-visible:outline-none focus-visible:ring-0",
            mobile ? "h-9 rounded-lg text-[0.8rem]" : "h-10 rounded-xl text-[0.84rem]"
          ].join(" ")}
        />
      </label>

      {open && normalizedQuery ? (
        <div
          id={resultsId}
          role="listbox"
          aria-label="Workspace search results"
          className={[
            "thin-scroll absolute top-[calc(100%+0.55rem)] z-50 max-h-[min(31rem,calc(100vh-5rem))] overflow-y-auto rounded-2xl border border-white/[0.1] bg-[#17181b] p-2 shadow-[0_28px_72px_-34px_rgba(0,0,0,0.98)]",
            mobile ? "left-0 w-[min(22rem,calc(100vw-4.5rem))]" : "left-0 w-[26rem]"
          ].join(" ")}
        >
          {loading && results.length === 0 ? (
            <div className="flex items-center gap-2 px-3 py-5 text-[0.8rem] text-cream/42">
              <Loader2 size={15} className="animate-spin" aria-hidden="true" />
              Searching your workspace…
            </div>
          ) : failed ? (
            <p className="px-3 py-5 text-[0.8rem] text-cream/42">
              Search is unavailable right now.
            </p>
          ) : results.length ? (
            WORKSPACE_SEARCH_GROUPS.map((group) => {
              const groupResults = results.filter((result) => result.group === group);
              if (!groupResults.length) return null;

              return (
                <section key={group} aria-label={group} className="mb-1 last:mb-0">
                  <p className="px-3 pb-1 pt-2 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-cream/30">
                    {group}
                  </p>
                  {groupResults.map((result) => {
                    const index = results.findIndex((item) => item.id === result.id);
                    const Icon = searchResultIcon(result.kind);
                    const active = index === activeIndex;
                    return (
                      <Link
                        id={`${resultsId}-${result.id}`}
                        role="option"
                        aria-selected={active}
                        key={result.id}
                        href={result.href}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={(event) => {
                          event.preventDefault();
                          chooseResult(result);
                        }}
                        className={[
                          "group flex items-start gap-3 rounded-xl px-3 py-2.5 outline-none transition",
                          active ? "bg-white/[0.07]" : "hover:bg-white/[0.045]"
                        ].join(" ")}
                      >
                        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/[0.045] text-cream/52 transition group-hover:text-cream/75">
                          <Icon size={15} strokeWidth={1.8} aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-3">
                            <span className="truncate text-[0.84rem] font-semibold text-cream/82">
                              {result.title}
                            </span>
                            {result.badge ? (
                              <span className="shrink-0 text-[9.5px] text-cream/30">
                                {result.badge}
                              </span>
                            ) : null}
                          </span>
                          <span className="mt-0.5 line-clamp-1 block text-[0.72rem] leading-5 text-cream/38">
                            {result.description}
                          </span>
                        </span>
                      </Link>
                    );
                  })}
                </section>
              );
            })
          ) : (
            <p className="px-3 py-5 text-[0.8rem] text-cream/42">
              No questions, notes, interviews, or pages found.
            </p>
          )}
          {loading && results.length > 0 ? (
            <Loader2
              size={13}
              className="absolute right-3 top-3 animate-spin text-cream/30"
              aria-label="Updating search results"
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function searchResultIcon(kind: WorkspaceSearchKind) {
  if (kind === "question") return FileQuestion;
  if (kind === "practice") return BookOpen;
  if (kind === "interview") return Mic;
  if (kind === "note") return StickyNote;
  return Search;
}
