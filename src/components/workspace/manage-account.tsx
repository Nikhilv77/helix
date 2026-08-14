"use client";

import { SignOutButton, useReverification, useUser } from "@clerk/nextjs";
import { isReverificationCancelledError } from "@clerk/nextjs/errors";
import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ApiClientError, deleteAccount } from "@/lib/api-client";

export function ManageAccount() {
  const { user } = useUser();
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [showDeleteWarning, setShowDeleteWarning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canDelete = confirmation.trim().toUpperCase() === "DELETE";
  const name =
    user?.fullName ?? user?.firstName ?? user?.primaryEmailAddress?.emailAddress ?? "Your account";
  const email = user?.primaryEmailAddress?.emailAddress ?? "";
  const deleteAccountWithReverification = useReverification(deleteAccount);

  const onDelete = async () => {
    if (!canDelete || deleting) return;

    setDeleting(true);
    setError(null);
    try {
      await deleteAccountWithReverification();
      window.location.replace("/");
    } catch (caught) {
      setDeleting(false);
      setShowDeleteWarning(false);

      if (isReverificationCancelledError(caught)) {
        return;
      }

      setError(caught instanceof ApiClientError ? caught.message : "Could not delete account.");
    }
  };

  return (
    <section className="relative mx-auto flex min-h-screen w-full max-w-[92rem] flex-col px-5 py-8 text-cream sm:px-8 lg:px-10">
      <ManageBackdrop />

      <div className="relative z-10 mx-auto w-full max-w-5xl pt-8 sm:pt-12">
        <p className="mx-auto w-fit border-b border-cream/56 px-3 pb-2 text-center text-[1rem] text-cream/86">
          Manage account
        </p>
        <h1 className="mx-auto mt-6 max-w-3xl text-center text-[clamp(2rem,4vw,3.6rem)] font-medium leading-[1.04] text-cream">
          Account access and control.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-center text-[1rem] leading-7 text-cream/68 sm:text-[1.08rem]">
          Keep your session simple, or permanently remove your Trailgrad account when you are sure.
        </p>
      </div>

      <div className="relative z-10 mx-auto mt-10 w-full max-w-4xl text-center">
        <p className="mx-auto max-w-3xl text-[1.15rem] leading-8 text-cream/78 sm:text-[1.28rem] sm:leading-9">
          You are signed in as{" "}
          <span className="rounded-lg bg-cream/[0.08] px-2.5 py-0.5 text-cream">{name}</span>
          {email ? (
            <>
              {" "}
              with{" "}
              <span className="rounded-lg bg-cream/[0.08] px-2.5 py-0.5 text-cream">{email}</span>.
            </>
          ) : (
            "."
          )}{" "}
          Trailgrad uses this account for your profile, roadmap progress, interview history, and
          account recovery.
        </p>

        <SignOutButton redirectUrl="/">
          <button
            type="button"
            className="mt-8 inline-flex min-h-12 rotate-1 items-center justify-center rounded-lg border border-cream/28 bg-cream/[0.035] px-8 text-[1rem] font-medium text-cream/84 outline-none backdrop-blur-sm transition duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:rotate-0 hover:border-cream/44 hover:bg-cream/[0.07] hover:text-cream focus-visible:ring-2 focus-visible:ring-cream/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#3657b4]"
          >
            Logout
          </button>
        </SignOutButton>
      </div>

      <div className="relative z-10 mx-auto mt-12 w-full max-w-4xl rounded-2xl border border-cream/20 bg-[#ffebe0]/[0.038] p-5 backdrop-blur-sm sm:p-7">
        <h2 className="mt-5 text-[1.35rem] font-medium text-cream">Delete account</h2>
        <p className="mt-2 max-w-2xl text-[0.98rem] leading-7 text-cream/64">
          Permanently removes your Trailgrad profile, roadmap progress, interviews, and Clerk
          account. This cannot be undone.
        </p>
        <p className="mt-3 max-w-2xl text-[0.95rem] leading-7 text-cream/52">
          Type DELETE below only when you are sure you do not need your saved practice history or
          interview profile again.
        </p>

        <div className="mt-6 w-full max-w-md">
          <label className="block text-[0.86rem] text-cream/58 " htmlFor="delete-confirmation">
            Type DELETE to confirm
          </label>
          <input
            id="delete-confirmation"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            className="mt-2 h-11 w-full rounded-lg border border-cream/20 bg-cream/[0.045] px-3 text-cream outline-none transition focus:border-cream/44"
            autoComplete="off"
          />
          {error ? <p className="mt-2 text-[0.86rem] text-[#ffd0a6]">{error}</p> : null}
          <button
            type="button"
            onClick={() => setShowDeleteWarning(true)}
            disabled={!canDelete || deleting}
            className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#ffe3d0] px-5 text-[0.95rem] font-medium text-[#251815] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Trash2 className="h-4 w-4" strokeWidth={1.8} />
            {deleting ? "Deleting" : "Delete account"}
          </button>
        </div>
      </div>

      {showDeleteWarning ? (
        <DeleteAccountWarningModal
          deleting={deleting}
          onCancel={() => setShowDeleteWarning(false)}
          onConfirm={onDelete}
        />
      ) : null}
    </section>
  );
}

function DeleteAccountWarningModal({
  deleting,
  onCancel,
  onConfirm
}: {
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setVisible(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  if (typeof document === "undefined") return null;

  const close = () => {
    if (deleting) return;
    setVisible(false);
    window.setTimeout(onCancel, 180);
  };

  return createPortal(
    <div className="fixed inset-0 z-[90] grid place-items-center px-5">
      <button
        type="button"
        aria-label="Close delete account warning"
        className={`absolute inset-0 bg-[#050814]/48 backdrop-blur-md transition-opacity duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          visible ? "opacity-100" : "opacity-0"
        }`}
        onClick={close}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-account-warning-title"
        className={`relative w-full max-w-md rounded-2xl border border-cream/20 bg-[#3657b4] p-6 text-cream outline-none transition duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform ${
          visible ? "translate-y-0 scale-100 opacity-100" : "translate-y-4 scale-[0.97] opacity-0"
        }`}
      >
        <p
          id="delete-account-warning-title"
          className="text-center text-[1.55rem] font-medium leading-tight"
        >
          Delete account forever?
        </p>
        <p className="mx-auto mt-4 max-w-sm text-center text-[0.98rem] leading-7 text-cream/68">
          This removes your Trailgrad profile, progress, interviews, and Clerk account. You cannot
          undo this later.
        </p>

        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={close}
            disabled={deleting}
            className="inline-flex h-11 items-center justify-center rounded-lg border border-cream/20 bg-cream/[0.035] px-5 text-[0.95rem] font-medium text-cream/82 transition hover:bg-cream/[0.07] hover:text-cream disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#ffe3d0] px-5 text-[0.95rem] font-medium text-[#251815] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Trash2 className="h-4 w-4" strokeWidth={1.8} />
            {deleting ? "Deleting" : "Delete forever"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function ManageBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 hidden overflow-hidden text-cream xl:block"
    >
      <svg
        className="absolute left-0 top-20 h-32 w-52 opacity-[0.075] 2xl:left-5"
        viewBox="0 0 230 150"
        fill="none"
      >
        <rect x="18" y="24" width="160" height="68" rx="14" stroke="currentColor" />
        <circle cx="42" cy="48" r="5" fill="currentColor" fillOpacity="0.42" />
        <path d="M61 45h78M61 64h104" stroke="currentColor" strokeLinecap="round" />
        <path d="M28 116h178" stroke="currentColor" strokeLinecap="round" strokeDasharray="7 12" />
      </svg>

      <svg
        className="absolute left-8 top-[20rem] h-40 w-60 opacity-[0.06] 2xl:left-16"
        viewBox="0 0 260 180"
        fill="none"
      >
        <rect x="22" y="22" width="176" height="62" rx="15" stroke="currentColor" />
        <rect x="58" y="106" width="172" height="52" rx="13" stroke="currentColor" />
        <circle cx="48" cy="48" r="5" fill="currentColor" fillOpacity="0.42" />
        <circle cx="84" cy="130" r="5" fill="#9be8c1" fillOpacity="0.46" />
        <path d="M68 45h88M68 61h112M104 128h78M104 143h52" stroke="currentColor" />
        <path d="M198 53h28v78H230" stroke="currentColor" strokeDasharray="5 9" />
      </svg>

      <svg
        className="absolute left-0 top-[38rem] h-24 w-64 opacity-[0.052] 2xl:left-10"
        viewBox="0 0 300 120"
        fill="none"
      >
        <path d="M18 86h50m178 0h36" stroke="currentColor" strokeLinecap="round" />
        {Array.from({ length: 14 }, (_, item) => (
          <line
            key={item}
            x1={84 + item * 10}
            x2={84 + item * 10}
            y1={86 - ((item % 6) + 2) * 5}
            y2={86 + ((item % 6) + 2) * 5}
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="2.2"
          />
        ))}
        <path d="M72 24h150M72 42h96M72 60h122" stroke="currentColor" strokeOpacity="0.72" />
        <rect x="50" y="8" width="190" height="64" rx="14" stroke="currentColor" />
      </svg>

      <svg
        className="absolute right-0 top-[6.5rem] h-36 w-60 opacity-[0.075] 2xl:right-8"
        viewBox="0 0 280 180"
        fill="none"
      >
        <path d="M18 92h24m196 0h24" stroke="currentColor" />
        {Array.from({ length: 12 }, (_, item) => (
          <line
            key={item}
            x1={52 + item * 15}
            x2={52 + item * 15}
            y1={92 - ((item % 5) + 2) * 7}
            y2={92 + ((item % 5) + 2) * 7}
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="2.4"
          />
        ))}
        <circle cx="140" cy="92" r="74" stroke="currentColor" />
      </svg>

      <svg
        className="absolute right-5 top-[19rem] h-44 w-64 opacity-[0.06] 2xl:right-16"
        viewBox="0 0 300 200"
        fill="none"
      >
        <rect x="56" y="18" width="176" height="58" rx="14" stroke="currentColor" />
        <rect x="32" y="112" width="142" height="54" rx="14" stroke="currentColor" />
        <circle cx="82" cy="47" r="5" fill="#9be8c1" fillOpacity="0.5" />
        <circle cx="58" cy="138" r="5" fill="currentColor" fillOpacity="0.4" />
        <path d="M104 44h76M104 58h96M80 136h68M80 151h42" stroke="currentColor" />
        <path d="M146 76v36M146 94h92" stroke="currentColor" strokeDasharray="5 9" />
        <path d="M236 94l12-10M236 94l12 10" stroke="currentColor" strokeLinecap="round" />
      </svg>

      <svg
        className="absolute right-0 top-[36rem] h-32 w-64 opacity-[0.052] 2xl:right-12"
        viewBox="0 0 300 150"
        fill="none"
      >
        <path d="M72 32h156M72 52h104M72 72h132" stroke="currentColor" />
        <rect x="48" y="14" width="204" height="78" rx="16" stroke="currentColor" />
        <path
          d="M34 124 C 74 88, 108 88, 148 116 S 218 146, 266 92"
          stroke="#9be8c1"
          strokeOpacity="0.55"
          strokeDasharray="5 9"
        />
        <circle cx="148" cy="116" r="6" fill="currentColor" fillOpacity="0.35" />
        <circle cx="218" cy="122" r="6" fill="currentColor" fillOpacity="0.26" />
      </svg>

      <svg
        className="absolute left-20 top-[51rem] h-24 w-44 opacity-[0.05] 2xl:left-32"
        viewBox="0 0 180 120"
        fill="none"
      >
        {Array.from({ length: 18 }, (_, item) => (
          <circle
            key={item}
            cx={24 + (item % 6) * 24}
            cy={26 + Math.floor(item / 6) * 28}
            r="3"
            fill="currentColor"
            fillOpacity={item % 4 === 0 ? "0.48" : "0.24"}
          />
        ))}
        <path d="M28 96h124" stroke="currentColor" strokeDasharray="6 10" />
      </svg>

      <svg
        className="absolute right-16 top-[50rem] h-24 w-52 opacity-[0.05] 2xl:right-32"
        viewBox="0 0 210 110"
        fill="none"
      >
        <path d="M28 34h154M28 56h112M28 78h132" stroke="currentColor" />
        <path d="M16 20h178v76H16z" stroke="currentColor" />
        <path d="M54 20v76M118 20v76" stroke="currentColor" strokeOpacity="0.55" />
      </svg>

      <svg
        className="absolute left-2 top-[57rem] h-32 w-60 opacity-[0.05] 2xl:left-14"
        viewBox="0 0 270 150"
        fill="none"
      >
        <rect x="42" y="18" width="176" height="58" rx="14" stroke="currentColor" />
        <path d="M68 44h96M68 58h124" stroke="currentColor" />
        <path
          d="M30 120 C 70 82, 110 86, 146 110 S 214 144, 246 78"
          stroke="#9be8c1"
          strokeOpacity="0.48"
          strokeDasharray="5 9"
        />
        <circle cx="146" cy="110" r="6" fill="currentColor" fillOpacity="0.32" />
        <circle cx="214" cy="116" r="6" fill="currentColor" fillOpacity="0.24" />
      </svg>

      <svg
        className="absolute bottom-8 right-8 h-24 w-44 opacity-[0.06] 2xl:right-24"
        viewBox="0 0 180 120"
        fill="none"
      >
        <path d="M24 28h132v64H24z" stroke="currentColor" />
        <path d="M56 28v64M100 28v64M24 58h132" stroke="currentColor" strokeOpacity="0.58" />
        <circle cx="42" cy="44" r="5" fill="currentColor" fillOpacity="0.46" />
        <circle cx="80" cy="76" r="5" fill="#9be8c1" fillOpacity="0.52" />
        <circle cx="124" cy="44" r="5" fill="currentColor" fillOpacity="0.34" />
      </svg>
    </div>
  );
}
