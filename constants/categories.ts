export const CATEGORY_OPTIONS = [
  "Academic",
  "Competitive Exams",
  "Professional Courses",
  "Career & Placements",
  "Technology & AI",
  "Startups & Entrepreneurship",
  "Finance & Investing",
  "Creative & Design",
  "Personal Development"
] as const;

export type CategoryOption = (typeof CATEGORY_OPTIONS)[number];
