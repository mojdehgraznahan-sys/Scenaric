// Scenaric.ai — APAC Expansion 2030 demo content
// Based on Peter Schwartz's 9-step methodology

window.FM_DATA = {
  project: {
    name: "APAC Expansion 2030",
    role: "Owner",
    focal_question: "How should we approach SEA market entry given geopolitical uncertainty over the next 5-10 years?",
    horizon: "5–10 years",
    industry: "Technology",
    summary: "Strategic planning for Southeast Asia expansion across Indonesia, Vietnam, Philippines, and Thailand markets.",
    created: "Feb 14, 2026",
  },
  projects: [
    {
      id: "proj_apac",
      name: "APAC Expansion 2030",
      focal_question: "How should we approach SEA market entry given geopolitical uncertainty over the next 5-10 years?",
      horizon: "5–10 years",
      industry: "Technology",
      stepsComplete: 4,
      lastEdited: "2026-07-05T14:20:00Z",
      archived: false,
    },
    {
      id: "proj_supply",
      name: "Supply Chain Disruption Planning",
      focal_question: "How resilient does our APAC supply chain need to be against a 2027-2030 disruption event?",
      horizon: "3–5 years",
      industry: "Manufacturing",
      stepsComplete: 2,
      lastEdited: "2026-06-28T09:05:00Z",
      archived: false,
    },
    {
      id: "proj_ai_reg",
      name: "AI Regulation Outlook",
      focal_question: "How will AI regulation reshape our product roadmap and go-to-market over the next 5 years?",
      horizon: "5 years",
      industry: "Technology",
      stepsComplete: 0,
      lastEdited: "2026-07-07T11:40:00Z",
      archived: false,
    },
    {
      id: "proj_talent",
      name: "2026 Talent Strategy Review",
      focal_question: "What workforce model best positions us for a 3-5 year horizon of hybrid work and AI-augmented roles?",
      horizon: "3–5 years",
      industry: "Technology",
      stepsComplete: 8,
      lastEdited: "2026-05-02T16:00:00Z",
      archived: true,
    },
  ],
  stats: {
    sources: 12, interviews: 5, insights: 48, voices: 9,
    signals: 23, scenarios: 4, indicators: 11,
  },
  sources: [
    { id: "s1", name: "2025 Annual Strategy Review.pdf", type: "doc", status: "Complete", progress: 100 },
    { id: "s2", name: "CEO Interview — Jan Oosterom.mp3", type: "audio", status: "Processing", progress: 62 },
    { id: "s3", name: "McKinsey APAC Outlook Q4.pdf", type: "doc", status: "Complete", progress: 100 },
    { id: "s4", name: "Internal SEA Customer Survey.csv", type: "survey", status: "Complete", progress: 100 },
    { id: "s5", name: "ASEAN Trade Policy Brief.pdf", type: "doc", status: "Complete", progress: 100 },
  ],
  interviews: [
    {
      id: "i1", initials: "JO", name: "Jan Oosterom", role: "CEO · 18 min",
      avatar_bg: "#E5E7EB", avatar_fg: "#6B7280",
      tag: "Political", status: "Processing",
      quote: "The biggest unknown is how fast regulation will shift in key markets."
    },
    {
      id: "i2", initials: "SC", name: "Sarah Chen", role: "COO · Transcript",
      avatar_bg: "#DBEAFE", avatar_fg: "#1D4ED8",
      tag: "Social", status: "Complete",
      quote: "Our workforce doesn't have the skills for the AI transition we're planning."
    },
    {
      id: "i3", initials: "MR", name: "Maya R.", role: "VP Strategy · 24 min",
      avatar_bg: "#EDE9FE", avatar_fg: "#6D28D9",
      tag: "Economic", status: "Complete",
      quote: "Currency volatility could swing margins by ten points either way."
    },
  ],
  insights: [
    "Supply chain resilience flagged by 78% of managers as most critical uncertainty for the next 3 years.",
    "Indonesian protectionism cited in 4 of 5 executive interviews as accelerating risk.",
    "Gen Z hiring expectations diverge sharply from current compensation framework.",
  ],
  signals: [
    { id: "sg1", category: "Political", source: "Reuters",  title: "EU Carbon Border Adjustment Mechanism", impact: 5, uncertainty: "High",   body: "New tariffs on carbon-intensive imports will reshape competitive dynamics across SEA supply chains by 2027." },
    { id: "sg2", category: "Technology", source: "Gartner",  title: "Gen AI enterprise adoption accelerates", impact: 5, uncertainty: "Medium", body: "Enterprise AI deployment doubled YoY; productivity gains captured unevenly across sectors and geographies." },
    { id: "sg3", category: "Social", source: "Deloitte",     title: "Gen Z workforce expectations shift",     impact: 4, uncertainty: "Medium", body: "Workers under 30 prioritise purpose over compensation; talent wars intensifying in tech hubs." },
    { id: "sg4", category: "Political", source: "FT",        title: "US-China decoupling deepens",            impact: 5, uncertainty: "High",   body: "Bifurcated technology stacks force multinationals to choose sides on cloud, semiconductors, and standards." },
    { id: "sg5", category: "Economic", source: "World Bank", title: "SEA middle-class doubles by 2030",       impact: 4, uncertainty: "Low",    body: "Rising disposable income across Indonesia, Vietnam, Philippines fuels premium consumer categories." },
    { id: "sg6", category: "Ecological", source: "IPCC",     title: "Climate adaptation costs surge",         impact: 4, uncertainty: "High",   body: "Physical risk premiums for coastal SEA operations rising; ESG reporting mandates tighten." },
    { id: "sg7", category: "Technology", source: "IDC",      title: "Mobile-first commerce dominates",        impact: 3, uncertainty: "Low",    body: "Over 70% of SEA digital commerce flows through super-apps; web channels secondary." },
    { id: "sg8", category: "Political", source: "Nikkei",    title: "ASEAN trade harmonisation stalls",       impact: 4, uncertainty: "High",   body: "Regional trade agreement implementation patchy; bilateral arrangements proliferate." },
    { id: "sg9", category: "Economic", source: "Bloomberg",  title: "Currency volatility regime",             impact: 4, uncertainty: "High",   body: "FX swings of 10-15% reshape unit economics for cross-border operations." },
  ],
  scenarios: [
    {
      id: "sc1", name: "Pacific Connector", quadrant: "TR", color: "#10B981",
      tagline: "Open markets + aligned geopolitics",
      summary: "ASEAN consolidates as a unified trade bloc; multilateral institutions hold; AI productivity is broadly captured. Our expansion runs ahead of plan.",
      narrative: "By 2030, ASEAN has matured into a functional trade bloc. Customs harmonisation cleared in 2027 and digital service tariffs were eliminated by mid-decade. US-China relations stabilised after a 2026 climbdown, allowing dual-track operations to consolidate onto shared infrastructure. AI productivity gains were widely diffused: SEA-based enterprises saw 2-4% annual TFP growth from 2027 onward. For us, this is the high road. Single regional HQ in Singapore, distributed engineering across Ho Chi Minh and Jakarta, premium consumer expansion in Bangkok. Growth runs 30% ahead of plan; margins improve 600bps.",
    },
    {
      id: "sc2", name: "Fragmented Frontier", quadrant: "BR", color: "#F97316",
      tagline: "Open markets + misaligned politics",
      summary: "Markets stay open but politics fragment. Multiple AI stacks, multiple compliance regimes. Speed and modularity beat scale.",
      narrative: "Trade flows continue but politics atomise. By 2027, three competing AI/cloud stacks (Western, Chinese, sovereign) force market-by-market decisions. Regulators in Indonesia, Vietnam, and the Philippines diverge sharply on data residency and content moderation. We respond by adopting a federated architecture: country-level pods with local stacks, shared brand and product spine. CAPEX rises 15% but speed-to-market improves; we win where local incumbents lack global capability.",
    },
    {
      id: "sc3", name: "Walled Gardens", quadrant: "TL", color: "#3B82F6",
      tagline: "Closed markets + aligned geopolitics",
      summary: "Geopolitical détente but rising protectionism. Local-for-local becomes mandatory. We trade scale for compliance.",
      narrative: "A surprising US-China climbdown in 2027 brings geopolitical calm — but the post-COVID instinct to onshore everything hardens into permanent industrial policy. SEA governments mandate local data, local IP, local employment. We restructure into autonomous country businesses with joint-venture partners. ROIC compresses but we hold share. The plan becomes operationally complex but politically resilient.",
    },
    {
      id: "sc4", name: "Bamboo Curtain", quadrant: "BL", color: "#EF4444",
      tagline: "Closed markets + fragmented politics",
      summary: "Worst case: blocs harden, decoupling accelerates. Investment thesis under threat; preserve optionality.",
      narrative: "Sino-Western relations rupture in late 2026; SEA nations are forced into alignment decisions. Capital controls reappear; tech sanctions escalate to consumer-facing services. We pull back from Indonesia and Philippines, consolidate Vietnam/Singapore, and preserve optionality through minority stakes in local champions. Revenue declines 20% but cash conversion improves; we wait for the regime to shift.",
    },
  ],
  axes: {
    x: "Geopolitical Alignment", // L: misaligned, R: aligned
    y: "Market Openness",        // T: open, B: closed -- wait re-check labels
  },
  // Quadrants used: TL Predetermined, TR Critical, BL Background, BR Wildcards
  quadrants: { TL: "Predetermined", TR: "Critical ★", BL: "Background", BR: "Wildcards" },
  matrix_dots: [
    // x,y in 0..100 percent (0 = left/top, 100 = right/bottom)
    { id: "d1", sigId: "sg1", x: 28, y: 30, label: "CO₂", color: "#EF4444", category: "Political" },
    { id: "d2", sigId: "sg2", x: 56, y: 26, label: "AI",  color: "#F97316", category: "Technology", selected: true },
    { id: "d3", sigId: "sg4", x: 71, y: 18, label: "Geo", color: "#EF4444", category: "Political" },
    { id: "d4", sigId: "sg3", x: 47, y: 36, label: "Z",   color: "#8B5CF6", category: "Social" },
    { id: "d5", sigId: "sg6", x: 33, y: 64, label: "Bio", color: "#14B8A6", category: "Ecological" },
    { id: "d6", sigId: "sg9", x: 60, y: 70, label: "FX",  color: "#10B981", category: "Economic" },
    { id: "d7", sigId: "sg5", x: 38, y: 78, label: "M+",  color: "#10B981", category: "Economic" },
    { id: "d8", sigId: "sg7", x: 50, y: 82, label: "Mob", color: "#3B82F6", category: "Technology" },
    { id: "d9", sigId: "sg8", x: 75, y: 42, label: "Tx",  color: "#EF4444", category: "Political" },
  ],
  indicators: [
    { id: "in1", name: "ASEAN customs harmonisation milestone", scenario: "Pacific Connector", status: "Watch", trend: "+", note: "Target Q3 2026" },
    { id: "in2", name: "US-China tariff schedule revisions", scenario: "Bamboo Curtain", status: "Alert", trend: "↑", note: "3 escalations YTD" },
    { id: "in3", name: "Indonesian data residency rulings", scenario: "Walled Gardens", status: "Watch", trend: "→", note: "Comment period open" },
    { id: "in4", name: "Enterprise AI capex (SEA)", scenario: "Pacific Connector", status: "On track", trend: "↑", note: "+34% YoY" },
    { id: "in5", name: "Vietnam dong volatility", scenario: "Fragmented Frontier", status: "Watch", trend: "↑", note: "12% band breached" },
    { id: "in6", name: "Cross-border cloud sanctions", scenario: "Bamboo Curtain", status: "Alert", trend: "↑", note: "2 new actions" },
  ],
  strategies: [
    { id: "st1", name: "Federated regional architecture",   robustIn: ["Pacific Connector", "Fragmented Frontier"], risk: "Low",    cost: "Medium",  notes: "Standardise core, localise edge. Resilient across alignment outcomes." },
    { id: "st2", name: "Singapore-anchored expansion",      robustIn: ["Pacific Connector", "Walled Gardens"],      risk: "Medium", cost: "High",    notes: "Strong if openness holds; capital at risk in bamboo curtain." },
    { id: "st3", name: "JV-first market entry",             robustIn: ["Walled Gardens", "Fragmented Frontier"],    risk: "Low",    cost: "Low",     notes: "Slower but politically resilient. Preserves optionality." },
    { id: "st4", name: "Hedge through minority stakes",     robustIn: ["Bamboo Curtain", "Walled Gardens"],         risk: "Medium", cost: "Low",     notes: "Optionality play. Returns lower but downside protected." },
  ],
  news: [
    { id: "n1", title: "Climate Regulation Proposal in EU expands carbon border tariffs", source: "Reuters",   time: "2h",  impact: "HIGH" },
    { id: "n2", title: "Major Tech Company AI breakthroughs lift productivity outlook",   source: "FT",         time: "5h",  impact: "MID" },
    { id: "n3", title: "Consumer Sustainability Survey shows shift in SEA preferences",   source: "Deloitte",   time: "1d",  impact: "MID" },
    { id: "n4", title: "Indonesia drafts new data localisation framework",                source: "Nikkei",     time: "1d",  impact: "HIGH" },
    { id: "n5", title: "Vietnam dong fluctuation breaches managed-float band",            source: "Bloomberg",  time: "2d",  impact: "MID" },
  ],
  recommended: [
    { title: "Analyse summaries",   body: "Surface the key tensions across your interview transcripts." },
    { title: "Identify trends",     body: "Cluster signals into emerging themes by STEEP category." },
    { title: "Explore scenarios",   body: "Plot critical uncertainties on a 2×2 matrix." },
    { title: "Generate insights",   body: "Get 1-pagers per scenario with implications." },
  ],
  chat_seed: [
    { role: "ai", text: "Welcome back. Ready to build robust scenarios?" },
    { role: "ai", text: "I've flagged 3 driving forces across your research." },
  ],
};
