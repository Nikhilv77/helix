export type LegalSection = {
  title: string;
  body: string;
};

export type LegalDocument = {
  eyebrow: string;
  title: string;
  introduction: string;
  updatedAt: string;
  sections: LegalSection[];
};

const updatedAt = "August 8, 2026";

export const privacyPolicy: LegalDocument = {
  eyebrow: "Trailgrad Privacy",
  title: "Privacy Policy",
  introduction:
    "A clear summary of what Trailgrad processes when you upload a resume, practice interviews, and review reports.",
  updatedAt,
  sections: [
    {
      title: "Information we process",
      body: "Trailgrad processes profile details, resume text, interview answers, transcripts, progress, and reports so your practice can stay relevant to your goals."
    },
    {
      title: "Resume handling",
      body: "Resume files are used to extract interview evidence. The current flow reads the uploaded file in memory and does not store the original file."
    },
    {
      title: "Workspace data",
      body: "Interview transcripts, reports, progress, and profile settings stay inside your private account workspace."
    },
    {
      title: "Service providers",
      body: "Trailgrad may use authentication, infrastructure, database, voice, and AI providers. They process data only as needed to run product features."
    },
    {
      title: "Security",
      body: "We use reasonable technical and organizational safeguards to protect your data. No internet service can be guaranteed perfectly secure."
    }
  ]
};

export const termsOfService: LegalDocument = {
  eyebrow: "Trailgrad Legal",
  title: "Terms of Service",
  introduction: "The simple agreement for using Trailgrad interview practice.",
  updatedAt,
  sections: [
    {
      title: "Using Trailgrad",
      body: "Trailgrad is an AI interview practice workspace. You are responsible for the information you provide and how you use practice feedback."
    },
    {
      title: "AI feedback",
      body: "Prompts, scores, reports, and suggestions are practice aids. They are not hiring decisions, employment advice, or a guarantee of interview performance."
    },
    {
      title: "Your content",
      body: "You keep ownership of your resume, answers, transcripts, and profile content. Trailgrad processes that content to provide and improve the product."
    },
    {
      title: "Acceptable use",
      body: "Do not misuse the service, disrupt the product, reverse engineer protected systems, upload harmful content, or use Trailgrad for unlawful activity."
    },
    {
      title: "Availability",
      body: "Trailgrad may change, pause, or discontinue parts of the service. The product is provided without warranties to the fullest extent allowed by law."
    }
  ]
};
