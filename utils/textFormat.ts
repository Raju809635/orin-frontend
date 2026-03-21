export function markdownToPlainText(input: string): string {
  const md = String(input || "").replace(/\r\n/g, "\n");

  return md
    // Headings
    .replace(/^#{1,6}\s+/gm, "")
    // Bold/italic/code
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    // Links: [text](url) -> text (url)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    // Bullets
    .replace(/^\s*[-*+]\s+/gm, "• ")
    // Extra spacing
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function escapeHtml(input: string): string {
  return String(input || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

