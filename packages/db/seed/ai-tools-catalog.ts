export const AI_TOOLS_CATALOG = [
  {
    name: "ChatGPT",
    vendor: "OpenAI",
    category: "chat" as const,
    pricingModel: "per_seat" as const,
    plans: [
      { name: "Plus", price_monthly: 20, limits: "GPT-4o, 80 msgs/3h" },
      { name: "Team", price_monthly: 25, price_annual_monthly: 25, limits: "Higher limits, admin console" },
      { name: "Enterprise", price_monthly: null, limits: "Custom, SSO, audit" }
    ],
    hasApi: false, hasSso: true, hasDpa: true,
    dataResidency: ["US"], trainsOnData: "opt-out",
    websiteUrl: "https://chat.openai.com",
    isVerified: true,
  },
  {
    name: "Claude Pro",
    vendor: "Anthropic",
    category: "chat" as const,
    pricingModel: "per_seat" as const,
    plans: [
      { name: "Pro", price_monthly: 20, limits: "5x more usage" },
      { name: "Team", price_monthly: 25, limits: "Higher limits, admin" },
      { name: "Enterprise", price_monthly: null, limits: "Custom, SSO, SCIM" }
    ],
    hasApi: false, hasSso: true, hasDpa: true,
    dataResidency: ["US"], trainsOnData: "no",
    websiteUrl: "https://claude.ai",
    isVerified: true,
  },
  {
    name: "Cursor",
    vendor: "Anysphere",
    category: "ide" as const,
    pricingModel: "per_seat" as const,
    plans: [
      { name: "Pro", price_monthly: 20, limits: "500 fast requests/mês" },
      { name: "Business", price_monthly: 40, limits: "Unlimited, admin, SSO" }
    ],
    hasApi: false, hasSso: true, hasDpa: true,
    trainsOnData: "opt-out",
    websiteUrl: "https://cursor.com",
    isVerified: true,
  },
  {
    name: "Lovable",
    vendor: "Lovable",
    category: "app_builder" as const,
    pricingModel: "per_credit" as const,
    plans: [
      { name: "Starter", price_monthly: 20, limits: "5 projects" },
      { name: "Launch", price_monthly: 50, limits: "Unlimited projects" },
      { name: "Scale", price_monthly: 100, limits: "Priority, more credits" }
    ],
    hasApi: false, hasSso: false, hasDpa: false,
    trainsOnData: "unknown",
    websiteUrl: "https://lovable.dev",
  },
  {
    name: "v0",
    vendor: "Vercel",
    category: "code_gen" as const,
    pricingModel: "per_credit" as const,
    plans: [
      { name: "Premium", price_monthly: 20, limits: "200 credits/mês" }
    ],
    hasApi: false, hasSso: false, hasDpa: false,
    trainsOnData: "unknown",
    websiteUrl: "https://v0.dev",
  },
  {
    name: "Midjourney",
    vendor: "Midjourney",
    category: "image_gen" as const,
    pricingModel: "per_seat" as const,
    plans: [
      { name: "Basic", price_monthly: 10, limits: "200 imgs/mês" },
      { name: "Standard", price_monthly: 30, limits: "Unlimited relaxed" },
      { name: "Pro", price_monthly: 60, limits: "Fast hours + stealth" }
    ],
    hasApi: false, hasSso: false, hasDpa: false,
    trainsOnData: "yes",
    websiteUrl: "https://midjourney.com",
    complianceNotes: "Trains on user content by default. Not suitable for confidential work.",
  },
  {
    name: "GitHub Copilot",
    vendor: "GitHub/Microsoft",
    category: "ide" as const,
    pricingModel: "per_seat" as const,
    plans: [
      { name: "Individual", price_monthly: 10, limits: "Code completions" },
      { name: "Business", price_monthly: 19, limits: "Org management, policy" },
      { name: "Enterprise", price_monthly: 39, limits: "Fine-tuning, SSO" }
    ],
    hasApi: false, hasSso: true, hasDpa: true,
    trainsOnData: "opt-out",
    websiteUrl: "https://github.com/features/copilot",
    isVerified: true,
  },
  {
    name: "Claude Code",
    vendor: "Anthropic",
    category: "ide" as const,
    pricingModel: "per_seat" as const,
    plans: [
      { name: "Included in Max", price_monthly: 100, limits: "Included in Claude Max subscription" },
      { name: "API-based", price_monthly: null, limits: "Pay per usage via API" }
    ],
    hasApi: true, hasSso: true, hasDpa: true,
    trainsOnData: "no",
    websiteUrl: "https://claude.ai/code",
    isVerified: true,
  },
  {
    name: "Base44",
    vendor: "Base44",
    category: "app_builder" as const,
    pricingModel: "per_seat" as const,
    plans: [
      { name: "Pro", price_monthly: 25, limits: "Unlimited apps" }
    ],
    hasApi: false, hasSso: false, hasDpa: false,
    trainsOnData: "unknown",
    websiteUrl: "https://base44.com",
  },
  {
    name: "Manus",
    vendor: "Manus AI",
    category: "agent" as const,
    pricingModel: "per_credit" as const,
    plans: [
      { name: "Pro", price_monthly: 39, limits: "Credits-based" }
    ],
    hasApi: false, hasSso: false, hasDpa: false,
    trainsOnData: "unknown",
    websiteUrl: "https://manus.im",
  },
  {
    name: "Gemini",
    vendor: "Google",
    category: "chat" as const,
    pricingModel: "per_seat" as const,
    plans: [
      { name: "Advanced", price_monthly: 20, limits: "Gemini Ultra" },
      { name: "Business", price_monthly: 24, limits: "Workspace integration" },
      { name: "Enterprise", price_monthly: 36, limits: "Advanced security" }
    ],
    hasApi: false, hasSso: true, hasDpa: true,
    dataResidency: ["US", "EU"], trainsOnData: "opt-out",
    websiteUrl: "https://gemini.google.com",
    isVerified: true,
  },
  {
    name: "DALL-E",
    vendor: "OpenAI",
    category: "image_gen" as const,
    pricingModel: "per_usage" as const,
    plans: [
      { name: "API", price_monthly: null, limits: "Pay per image" }
    ],
    hasApi: true, hasSso: false, hasDpa: true,
    trainsOnData: "no",
    websiteUrl: "https://openai.com/dall-e",
  },
  {
    name: "Perplexity",
    vendor: "Perplexity AI",
    category: "chat" as const,
    pricingModel: "per_seat" as const,
    plans: [
      { name: "Pro", price_monthly: 20, limits: "Unlimited Pro searches" },
      { name: "Enterprise", price_monthly: 40, limits: "SSO, admin, API" }
    ],
    hasApi: true, hasSso: true, hasDpa: true,
    trainsOnData: "no",
    websiteUrl: "https://perplexity.ai",
    isVerified: true,
  },
  {
    name: "Runway",
    vendor: "Runway",
    category: "video" as const,
    pricingModel: "per_credit" as const,
    plans: [
      { name: "Standard", price_monthly: 12, limits: "625 credits/mês" },
      { name: "Pro", price_monthly: 28, limits: "2250 credits/mês" },
      { name: "Unlimited", price_monthly: 76, limits: "Unlimited generations" }
    ],
    hasApi: true, hasSso: false, hasDpa: false,
    trainsOnData: "opt-out",
    websiteUrl: "https://runway.ml",
  },
  {
    name: "ElevenLabs",
    vendor: "ElevenLabs",
    category: "audio" as const,
    pricingModel: "per_usage" as const,
    plans: [
      { name: "Starter", price_monthly: 5, limits: "30k chars/mês" },
      { name: "Creator", price_monthly: 22, limits: "100k chars/mês" },
      { name: "Pro", price_monthly: 99, limits: "500k chars + API" }
    ],
    hasApi: true, hasSso: false, hasDpa: false,
    trainsOnData: "no",
    websiteUrl: "https://elevenlabs.io",
  },
  {
    name: "Jasper",
    vendor: "Jasper AI",
    category: "writing" as const,
    pricingModel: "per_seat" as const,
    plans: [
      { name: "Creator", price_monthly: 49, limits: "1 user, unlimited words" },
      { name: "Teams", price_monthly: 125, limits: "3 users, brand voices" },
      { name: "Business", price_monthly: null, limits: "Custom, SSO" }
    ],
    hasApi: false, hasSso: true, hasDpa: true,
    trainsOnData: "opt-out",
    websiteUrl: "https://jasper.ai",
  },
  {
    name: "Notion AI",
    vendor: "Notion",
    category: "writing" as const,
    pricingModel: "per_seat" as const,
    plans: [
      { name: "Add-on", price_monthly: 10, limits: "Unlimited AI responses per seat" }
    ],
    hasApi: false, hasSso: true, hasDpa: true,
    trainsOnData: "opt-out",
    websiteUrl: "https://notion.so",
    isVerified: true,
  },
  {
    name: "Canva AI",
    vendor: "Canva",
    category: "design" as const,
    pricingModel: "per_seat" as const,
    plans: [
      { name: "Pro", price_monthly: 15, limits: "Included in Pro" },
      { name: "Teams", price_monthly: 10, limits: "Per user/month" }
    ],
    hasApi: false, hasSso: true, hasDpa: true,
    trainsOnData: "opt-out",
    websiteUrl: "https://canva.com",
    isVerified: true,
  },
];
