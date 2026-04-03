import { api } from "@/lib/api";

export type DomainTreeResponse = {
  version: string;
  updatedAt: string;
  tree: Record<string, Record<string, string[]>>;
  primaryCategories: string[];
  subCategoriesByPrimary: Record<string, string[]>;
  focusByPrimarySub: Record<string, string[]>;
};

let cached: { at: number; data: DomainTreeResponse } | null = null;
const CACHE_MS = 5 * 60 * 1000;

const FALLBACK_TREE: Record<string, Record<string, string[]>> = {
  Academic: {
    School: ["Math", "Science", "English", "Social Studies"],
    Intermediate: ["MPC", "BiPC", "MEC", "CEC"],
    Engineering: ["CSE", "ECE", "EEE", "Mechanical"],
    MBA: ["Marketing", "Finance", "Operations", "HR"],
    Law: ["Constitutional Law", "Corporate Law", "Litigation"]
  },
  "Competitive Exams": {
    JEE: ["JEE Main", "JEE Advanced", "Revision Strategy"],
    NEET: ["Biology", "Physics", "Chemistry"],
    UPSC: ["Prelims", "Mains", "Interview"],
    SSC: ["CGL", "CHSL", "Reasoning"],
    TGPSC: ["Group 1", "Group 2", "General Studies"],
    "Banking Exams": ["IBPS", "SBI PO", "Clerical"]
  },
  "Professional Courses": {
    CA: ["Foundation", "Inter", "Final"],
    CS: ["Executive", "Professional"],
    CMA: ["Foundation", "Inter", "Final"]
  },
  "Career & Placements": {
    Placements: ["Resume Review", "Mock Interviews", "Aptitude"],
    "Career Guidance": ["Roadmap Planning", "Role Selection", "Higher Studies"]
  },
  "Technology & AI": {
    "Web Development": ["Frontend", "Backend", "Full Stack"],
    "Data Science": ["Python", "Statistics", "Data Visualization"],
    "AI/ML": ["Machine Learning", "Deep Learning", "MLOps"]
  },
  "Startups & Entrepreneurship": {
    Startup: ["Idea Validation", "MVP Building", "Fundraising"],
    Growth: ["Go-To-Market", "Sales", "Team Building"]
  },
  "Finance & Investing": {
    Investing: ["Stocks", "Mutual Funds", "Portfolio Strategy"],
    Finance: ["Budgeting", "Personal Finance", "Risk Management"]
  },
  "Creative & Design": {
    Design: ["UI Design", "UX Research", "Product Design"],
    Creative: ["Branding", "Content", "Visual Storytelling"]
  },
  "Personal Development": {
    Growth: ["Communication", "Productivity", "Leadership"],
    Wellness: ["Mindset", "Work-Life Balance", "Confidence Building"]
  }
};

function buildResponse(tree: Record<string, Record<string, string[]>>): DomainTreeResponse {
  const primaryCategories = Object.keys(tree);
  const subCategoriesByPrimary: Record<string, string[]> = {};
  const focusByPrimarySub: Record<string, string[]> = {};
  primaryCategories.forEach((primary) => {
    const subMap = tree[primary] || {};
    const subs = Object.keys(subMap);
    subCategoriesByPrimary[primary] = subs;
    subs.forEach((sub) => {
      focusByPrimarySub[`${primary}::${sub}`] = (subMap[sub] || []).slice();
    });
  });
  return {
    version: "domain-tree-fallback-v1",
    updatedAt: new Date().toISOString(),
    tree,
    primaryCategories,
    subCategoriesByPrimary,
    focusByPrimarySub
  };
}

export function getFallbackDomainTree(): DomainTreeResponse {
  return buildResponse(FALLBACK_TREE);
}

export async function getDomainTree(): Promise<DomainTreeResponse> {
  const now = Date.now();
  if (cached && now - cached.at < CACHE_MS) return cached.data;
  try {
    const { data } = await api.get<DomainTreeResponse>("/api/meta/domain-tree");
    cached = { at: now, data };
    return data;
  } catch {
    const data = cached?.data || getFallbackDomainTree();
    cached = { at: now, data };
    return data;
  }
}
