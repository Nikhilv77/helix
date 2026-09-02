/** Shared Clerk styling so every auth surface belongs to the Trailgrad product. */
export const clerkAppearance = {
  options: {
    logoImageUrl: "/brand/logo-transparent.png",
    logoLinkUrl: "/",
    logoPlacement: "inside" as const,
    socialButtonsVariant: "blockButton" as const,
    socialButtonsPlacement: "top" as const
  },
  variables: {
    colorPrimary: "#f3f1ec",
    colorPrimaryForeground: "#17181b",
    colorForeground: "#efe8d6",
    colorMuted: "#1a1b1e",
    colorMutedForeground: "#aaa9a5",
    colorBackground: "#121315",
    colorInput: "#1a1b1e",
    colorInputForeground: "#efe8d6",
    colorNeutral: "#efe8d6",
    colorBorder: "rgba(255, 255, 255, 0.075)",
    colorRing: "#F26E01",
    colorShadow: "#000000",
    colorModalBackdrop: "#080909",
    fontFamily: "var(--font-sans)",
    fontFamilyButtons: "var(--font-sans)",
    fontFamilyMono: "var(--font-mono)",
    fontSize: "0.875rem",
    borderRadius: "0.75rem",
    spacing: "1rem"
  },
  elements: {
    rootBox: "w-full",
    cardBox:
      "!w-[min(28rem,calc(100vw-2rem))] !max-h-[calc(100svh-1rem)] !overflow-y-auto !overflow-x-hidden !rounded-2xl !border !border-white/[0.07] !bg-[#121315] !shadow-[0_32px_90px_-48px_rgba(0,0,0,0.95)] !backdrop-blur-none max-sm:!w-[min(28rem,calc(100vw-1.25rem))]",
    card: "!border-none !bg-[radial-gradient(circle_at_50%_0%,rgba(242,110,1,0.025),transparent_42%)] !shadow-none max-sm:!p-5",
    modalBackdrop:
      "trailgrad-auth-backdrop trailgrad-auth-backdrop--plain !bg-[#080909] !backdrop-blur-none",
    modalContent: "!max-h-[100svh] !overflow-y-auto !px-4 !py-4 max-sm:!px-2 max-sm:!py-2",
    modalCloseButton:
      "!text-cream/55 transition hover:!bg-cream/10 hover:!text-cream focus-visible:!ring-2 focus-visible:!ring-cream/40",
    logoBox: "!mb-4 !bg-transparent max-sm:!mb-2",
    logoImage: "!h-10 !w-10 !rounded-none !bg-transparent !shadow-none max-sm:!h-8 max-sm:!w-8",
    header: "!gap-2 max-sm:!gap-1",
    headerTitle:
      "!font-display !text-2xl !font-semibold !tracking-tight !text-cream max-sm:!text-[1.65rem]",
    headerSubtitle: "!text-sm !leading-6 !text-cream/55 max-sm:!text-[0.95rem] max-sm:!leading-5",
    socialButtonsBlockButton:
      "!min-h-12 !border !border-white/[0.07] !bg-[#191a1d] !font-semibold !text-cream transition hover:!border-white/10 hover:!bg-[#1d1e22] max-sm:!min-h-11",
    socialButtonsBlockButtonText: "!font-semibold !text-cream",
    dividerLine: "!bg-cream/15",
    dividerText: "!font-mono !text-[10px] !uppercase !tracking-[0.16em] !text-cream/35",
    formFieldLabel: "!mb-2 !font-medium !text-cream/80",
    formFieldInput:
      "!min-h-12 !rounded-xl !border !border-white/[0.07] !bg-[#1a1b1e] !px-4 !text-cream !shadow-none placeholder:!text-cream/30 focus:!border-[#F26E01]/40 focus:!bg-[#1d1e21] focus:!ring-2 focus:!ring-[#F26E01]/[0.08] max-sm:!min-h-11",
    otpCodeFieldInputs: "!border-0 !bg-transparent !shadow-none",

    otpCodeFieldInput:
      "!border !border-cream/35 !bg-cream/18 !text-cream !shadow-none !ring-0 focus:!border-cream focus:!bg-cream/24 focus:!ring-2 focus:!ring-cream/28 data-[active=true]:!border-cream data-[active=true]:!bg-cream/90 data-[active=true]:!text-[#152864]",
    formButtonPrimary:
      "!min-h-12 !rounded-xl !bg-[#f3f1ec] !font-semibold !text-[#17181b] !shadow-none hover:!bg-white max-sm:!min-h-11",
    footer: "!border-none !bg-transparent !shadow-none",
    footerActionText: "!text-cream/45",
    footerActionLink: "!font-semibold !text-[#F26E01] hover:!text-[#F26E01]",
    footerPagesLink: "!text-cream/40 hover:!text-cream",
    identityPreview:
      "!mx-auto !mt-3 !min-h-10 !w-full !max-w-[23rem] !justify-center !gap-2 !rounded-xl !border !border-cream/20 !bg-cream/[0.075] !px-4 !py-2 !shadow-none [&_*]:!min-w-0",
    identityPreviewText:
      "!block !w-full !truncate !text-center !text-[0.95rem] !font-medium !leading-6 !text-cream",
    formFieldAction: "!text-cream/65 hover:!text-cream",
    formFieldErrorText: "!text-[#ffb6b6]"
  }
};

/** User management needs far more room than the compact sign-in card. */
export const userProfileAppearance = {
  variables: clerkAppearance.variables,
  elements: {
    rootBox: "!w-full",
    cardBox:
      "!w-[min(62rem,calc(100vw-2rem))] !max-w-none !overflow-hidden !rounded-2xl !border !border-white/[0.07] !bg-[#121315] !shadow-[0_32px_90px_-48px_rgba(0,0,0,0.95)] !backdrop-blur-none",
    card: "!min-h-[min(42rem,calc(100vh-3rem))] !w-full !border-none !bg-[radial-gradient(circle_at_50%_0%,rgba(242,110,1,0.022),transparent_42%)] !shadow-none",
    modalBackdrop: "trailgrad-auth-backdrop !bg-[#080909] !backdrop-blur-none",
    modalContent: "!p-4",
    modalCloseButton:
      "!right-5 !top-5 !text-cream/55 transition hover:!bg-cream/10 hover:!text-cream focus-visible:!ring-2 focus-visible:!ring-cream/40",
    navbar:
      "!w-60 !min-w-60 !border-r !border-cream/12 !bg-white/[0.03] !p-5 max-md:!w-full max-md:!min-w-0 max-md:!border-b max-md:!border-r-0",
    navbarButton:
      "!min-h-10 !rounded-lg !px-3 !font-medium !text-cream/65 transition hover:!bg-cream/[0.08] hover:!text-cream data-[active=true]:!bg-cream/12 data-[active=true]:!text-cream",
    navbarButtonIcon: "!text-cream/55",
    navbarMobileMenuButton: "!rounded-lg !border !border-cream/15 !bg-cream/[0.05] !text-cream",
    pageScrollBox: "!max-h-[min(42rem,calc(100vh-3rem))] !bg-[#0f1012]",
    page: "!px-8 !pb-8 !pt-7 max-md:!px-5",
    headerTitle: "!font-display !text-2xl !font-semibold !tracking-tight !text-cream",
    headerSubtitle: "!text-sm !leading-6 !text-cream/50",
    profileSection: "!border-b !border-cream/12 !py-6",
    profileSectionTitleText: "!font-semibold !text-cream",
    profileSectionContent: "!text-cream/65",
    profileSectionPrimaryButton:
      "!rounded-lg !border !border-cream/18 !bg-cream/[0.06] !font-semibold !text-cream hover:!bg-cream/10",
    avatarBox: "!h-16 !w-16 !border !border-cream/20",
    formFieldLabel: "!font-medium !text-cream/75",
    formFieldInput:
      "!min-h-11 !rounded-xl !border !border-white/[0.07] !bg-[#1a1b1e] !text-cream !shadow-none placeholder:!text-cream/30 focus:!border-[#F26E01]/40 focus:!bg-[#1d1e21] focus:!ring-2 focus:!ring-[#F26E01]/[0.08]",
    otpCodeFieldInputs: "!border-0 !bg-transparent !shadow-none",

    otpCodeFieldInput:
      "!border !border-cream/35 !bg-cream/18 !text-cream !shadow-none !ring-0 focus:!border-cream focus:!bg-cream/24 focus:!ring-2 focus:!ring-cream/28 data-[active=true]:!border-cream data-[active=true]:!bg-cream/90 data-[active=true]:!text-[#152864]",
    badge: "!border !border-cream/15 !bg-cream/[0.06] !text-cream/65",
    footer: "!border-none !bg-transparent !shadow-none",
    footerPagesLink: "!text-cream/40 hover:!text-cream"
  }
};
