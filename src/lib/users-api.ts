import { apiClient } from "./api-client";

export interface UserPreferences {
  currency: string;
  timezone: string;
  locale: string;
  weekStartsOn: number;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  emailVerifiedAt: boolean | string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  preferences?: UserPreferences;
}

export interface UserSession {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string;
  revokedAt: string | null;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface RevokeAllSessionsResponse {
  message: string;
  revokedCount: number;
}

interface UserSessionsResponse {
  sessions: UserSession[];
}

export const usersApi = {
  getProfile(): Promise<UserProfile> {
    return apiClient.get<UserProfile>("users/me");
  },

  updateProfile(input: {
    name?: string;
    email?: string;
  }): Promise<UserProfile> {
    return apiClient.patch<UserProfile>("users/me", input);
  },

  getPreferences(): Promise<UserPreferences> {
    return apiClient.get<UserPreferences>("users/me/preferences");
  },

  updatePreferences(input: Partial<UserPreferences>): Promise<UserPreferences> {
    return apiClient.patch<UserPreferences>("users/me/preferences", input);
  },

  changePassword(input: ChangePasswordInput): Promise<{ message: string }> {
    return apiClient.patch<{ message: string }>("users/me/password", input);
  },

  async getSessions(): Promise<UserSession[]> {
    const response =
      await apiClient.get<UserSessionsResponse>("users/me/sessions");

    return response.sessions ?? [];
  },

  revokeSession(sessionId: string): Promise<{ message: string }> {
    return apiClient.delete<{ message: string }>(
      `users/me/sessions/${encodeURIComponent(sessionId)}`,
    );
  },

  revokeAllSessions(): Promise<RevokeAllSessionsResponse> {
    return apiClient.delete<RevokeAllSessionsResponse>("users/me/sessions");
  },
};
