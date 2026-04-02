import { Platform, Share } from "react-native";
import { sanitizeDisplayText } from "@/utils/textSanitize";

type ShareablePost = {
  _id: string;
  content?: string;
  authorId?: {
    name?: string;
  } | null;
};

const ORIN_POST_BASE_URL = "https://orin-frontend.vercel.app/network";

function trimForShare(text: string, maxLength = 240) {
  const clean = sanitizeDisplayText(text || "").replace(/\s+/g, " ").trim();
  if (!clean) return "See this post on ORIN.";
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength - 1).trimEnd()}…`;
}

export async function sharePost(post: ShareablePost) {
  const authorName = post.authorId?.name?.trim() || "ORIN User";
  const postUrl = `${ORIN_POST_BASE_URL}?post=${post._id}`;
  const excerpt = trimForShare(post.content || "");
  const message = `${authorName} shared this on ORIN:\n\n${excerpt}\n\nOpen post: ${postUrl}`;

  const result = await Share.share(
    Platform.OS === "ios"
      ? {
          title: `Post by ${authorName}`,
          message,
          url: postUrl
        }
      : {
          title: `Post by ${authorName}`,
          message
        }
  );

  return result.action === Share.sharedAction;
}
