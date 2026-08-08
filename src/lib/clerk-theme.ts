/** Shared Clerk styling so every auth surface belongs to the Trailgrad product. */
export const clerkAppearance = {
  options: {
    // The tiled version: Clerk's card can be light, where the white-on-
    // transparent icon would disappear.
    logoImageUrl: "/brand/trailgrad-favicon.svg",
    logoLinkUrl: "/",
    logoPlacement: "inside" as const,
    socialButtonsVariant: "blockButton" as const,
    socialButtonsPlacement: "top" as const
  },
  variables: {
    colorPrimary: "#efe8d6",
    colorPrimaryForeground: "#152864",
    colorForeground: "#efe8d6",
    colorMuted: "#111a2e",
    colorMutedForeground: "#bcb7a8",
    colorBackground: "#0d1424",
    colorInput: "#080e1c",
    colorInputForeground: "#efe8d6",
    colorNeutral: "#efe8d6",
    colorBorder: "rgba(239, 232, 214, 0.2)",
    colorRing: "#efe8d6",
    colorShadow: "#04091a",
    colorModalBackdrop: "#04091a",
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
      "!w-[min(28rem,calc(100vw-2rem))] !overflow-hidden !rounded-2xl !border !border-cream/20 !bg-[#0d1424] !shadow-[0_30px_90px_rgba(4,9,26,0.75)] !backdrop-blur-none",
    card: "!border-none !bg-transparent !shadow-none",
    modalBackdrop: "!bg-[#04091a]/80 !backdrop-blur-md",
    modalContent: "!px-4",
    modalCloseButton:
      "!text-cream/55 transition hover:!bg-cream/10 hover:!text-cream focus-visible:!ring-2 focus-visible:!ring-cream/40",
    logoBox: "!mb-4",
    logoImage: "!h-10 !w-10",
    header: "!gap-2",
    headerTitle: "!font-display !text-2xl !font-semibold !tracking-tight !text-cream",
    headerSubtitle: "!text-sm !leading-6 !text-cream/55",
    socialButtonsBlockButton:
      "!min-h-12 !border !border-cream/20 !bg-cream/[0.06] !font-semibold !text-cream transition hover:!border-cream/35 hover:!bg-cream/10",
    socialButtonsBlockButtonText: "!font-semibold !text-cream",
    dividerLine: "!bg-cream/15",
    dividerText: "!font-mono !text-[10px] !uppercase !tracking-[0.16em] !text-cream/35",
    formFieldLabel: "!mb-2 !font-medium !text-cream/80",
    formFieldInput:
      "!min-h-12 !border !border-cream/20 !bg-white/[0.04] !px-4 !text-cream !shadow-none placeholder:!text-cream/30 focus:!border-cream/50 focus:!ring-2 focus:!ring-cream/10",
    formButtonPrimary:
      "!min-h-12 !bg-cream !font-semibold !text-blueprint !shadow-none transition hover:!bg-white active:!translate-y-px",
    footer: "!border-none !bg-transparent !shadow-none",
    footerActionText: "!text-cream/45",
    footerActionLink: "!font-semibold !text-cream hover:!text-white",
    footerPagesLink: "!text-cream/40 hover:!text-cream",
    identityPreview: "!border !border-cream/15 !bg-white/[0.04]",
    identityPreviewText: "!text-cream",
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
      "!w-[min(62rem,calc(100vw-2rem))] !max-w-none !overflow-hidden !rounded-2xl !border !border-cream/20 !bg-[#0d1424] !shadow-[0_32px_100px_rgba(4,9,26,0.8)] !backdrop-blur-none",
    card: "!min-h-[min(42rem,calc(100vh-3rem))] !w-full !border-none !bg-transparent !shadow-none",
    modalBackdrop: "!bg-[#04091a]/85 !backdrop-blur-md",
    modalContent: "!p-4",
    modalCloseButton:
      "!right-5 !top-5 !text-cream/55 transition hover:!bg-cream/10 hover:!text-cream focus-visible:!ring-2 focus-visible:!ring-cream/40",
    navbar:
      "!w-60 !min-w-60 !border-r !border-cream/12 !bg-white/[0.03] !p-5 max-md:!w-full max-md:!min-w-0 max-md:!border-b max-md:!border-r-0",
    navbarButton:
      "!min-h-10 !rounded-lg !px-3 !font-medium !text-cream/65 transition hover:!bg-cream/[0.08] hover:!text-cream data-[active=true]:!bg-cream/12 data-[active=true]:!text-cream",
    navbarButtonIcon: "!text-cream/55",
    navbarMobileMenuButton: "!rounded-lg !border !border-cream/15 !bg-cream/[0.05] !text-cream",
    pageScrollBox: "!max-h-[min(42rem,calc(100vh-3rem))] !bg-[#0d1424]",
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
      "!min-h-11 !border !border-cream/18 !bg-white/[0.04] !text-cream !shadow-none focus:!border-cream/45 focus:!ring-2 focus:!ring-cream/10",
    formButtonPrimary:
      "!min-h-11 !bg-cream !font-semibold !text-blueprint !shadow-none hover:!bg-white",
    badge: "!border !border-cream/15 !bg-cream/[0.06] !text-cream/65",
    footer: "!border-none !bg-transparent !shadow-none",
    footerPagesLink: "!text-cream/40 hover:!text-cream"
  }
};
