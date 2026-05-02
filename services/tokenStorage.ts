import AsyncStorage from "@react-native-async-storage/async-storage";

const TOKEN_KEY = "orin_auth_token";
const REFRESH_TOKEN_KEY = "orin_refresh_token";
const USER_KEY = "orin_auth_user";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: "student" | "mentor";
  isAdmin?: boolean;
  approvalStatus?: "pending" | "approved" | "rejected";
  mentorOrgRole?: "global_mentor" | "institution_teacher" | "organisation_head";
  primaryCategory?: string;
  subCategory?: string;
  specializations?: string[];
};

export async function saveAuthSession(token: string, refreshToken: string, user: AuthUser) {
  await AsyncStorage.setItem(TOKEN_KEY, token);
  await AsyncStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
}

export async function loadAuthSession() {
  const tokenValue = await AsyncStorage.getItem(TOKEN_KEY);
  const refreshTokenValue = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
  const userValue = await AsyncStorage.getItem(USER_KEY);

  if (!tokenValue || !refreshTokenValue || !userValue) {
    return null;
  }

  try {
    const parsedUser = JSON.parse(userValue) as AuthUser;
    return { token: tokenValue, refreshToken: refreshTokenValue, user: parsedUser };
  } catch {
    return null;
  }
}

export async function clearAuthSession() {
  await AsyncStorage.removeItem(TOKEN_KEY);
  await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
  await AsyncStorage.removeItem(USER_KEY);
}
