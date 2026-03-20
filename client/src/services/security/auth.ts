/* Authentication utilities. */
import { secureApiClient } from "./secureApi";

export interface LoginCredentials {
  email: string;
  password: string;
}

export const authService = {
  async login(credentials: LoginCredentials): Promise<void> {
    await secureApiClient.post("/auth/login", credentials);
  },

  async logout(): Promise<void> {
    await secureApiClient.post("/auth/logout");
  },

  isAuthenticated(): boolean {
    // Check if access_token cookie exists
    return document.cookie.includes("access_token=");
  },
};
