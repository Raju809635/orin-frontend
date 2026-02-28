export const CATEGORY_OPTIONS = [
  "Startups & Entrepreneurship",
  "Technology & AI",
  "Career & Placements",
  "Finance & Investing",
  "Creative & Design",
  "Personal Development"
] as const;

export type CategoryOption = (typeof CATEGORY_OPTIONS)[number];
