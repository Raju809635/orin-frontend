export const ORIN_CATEGORIES: Record<string, string[]> = {
  Academic: [
    "School (1-10)",
    "Intermediate (MPC, BiPC, MEC, CEC)",
    "Engineering (BTech)",
    "MBA",
    "Law"
  ],
  "Competitive Exams": ["JEE", "NEET", "UPSC", "SSC", "TGPSC", "Banking Exams"],
  "Professional Courses": ["CA", "CS", "CMA"],
  "Career & Placements": ["Resume Building", "Interview Prep", "Campus Placements", "Career Transitions"],
  "Technology & AI": ["Web Development", "Data Science", "AI/ML", "Mobile Development", "Cloud & DevOps"],
  "Startups & Entrepreneurship": ["Idea Validation", "Fundraising", "MVP Building", "Growth Strategy"],
  "Finance & Investing": ["Personal Finance", "Stock Market", "Mutual Funds", "Startup Finance"],
  "Creative & Design": ["UI/UX Design", "Graphic Design", "Content Creation", "Branding"],
  "Personal Development": ["Communication", "Productivity", "Leadership", "Mindset"]
};

export const PRIMARY_CATEGORIES = Object.keys(ORIN_CATEGORIES);

