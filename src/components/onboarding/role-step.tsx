"use client";

import Image from "next/image";
import { Check } from "lucide-react";
import { ACCENT, CARD, INK, roles } from "@/components/onboarding/onboarding-data";
import { StepHeader } from "@/components/onboarding/onboarding-ui";
import type { Role } from "@/lib/types";

export function RoleStep({
  selected,
  onSelect,
  onContinue
}: {
  selected: Role | null;
  onSelect: (role: Role) => void;
  onContinue: () => void;
}) {
  return (
    <>
      <StepHeader title="Which role are you preparing for?" />

      <div className="mx-auto mt-10 grid w-full max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {roles.map((option) => {
          const active = selected === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => {
                onSelect(option.value);
                onContinue();
              }}
              className={[
                "group relative flex min-h-[15rem] min-w-0 flex-col p-5 text-left outline-none transition duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-cream/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#3657b4]",
                CARD,
                active ? "bg-cream-soft" : "hover:bg-cream-soft"
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="relative block h-16 w-16 shrink-0 transition-transform duration-300 group-hover:scale-[1.06] sm:h-[4.5rem] sm:w-[4.5rem]">
                  <Image
                    src={option.image}
                    alt=""
                    aria-hidden="true"
                    fill
                    sizes="(min-width: 640px) 4.5rem, 4rem"
                    className="object-contain mix-blend-multiply"
                    style={{
                      filter: "saturate(0.5) contrast(0.88) brightness(1.12) opacity(0.9)"
                    }}
                  />
                </span>

                {active ? (
                  <span
                    aria-hidden
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-full"
                    style={{ backgroundColor: ACCENT, color: "#f1ead8" }}
                  >
                    <Check size={13} strokeWidth={3} />
                  </span>
                ) : null}
              </div>

              <span
                className="mt-5 block text-[1.45rem] font-semibold leading-tight tracking-tight"
                style={{ color: INK }}
              >
                {option.label}
              </span>
              <span className="mt-2 block min-h-[3rem] text-[15px] leading-6 text-[#13234f]/70">
                {option.detail}
              </span>
            </button>
          );
        })}
      </div>

    </>
  );
}
