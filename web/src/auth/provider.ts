import type { User } from "@/models/account";

/** The signed-in user, as UserService returns it. */
export type AuthUser = User;

/**
 * AuthProvider — every way the backend lets someone in:
 * Google (`GoogleAuth`), email + password (`GetUser`), and email sign-up
 * (`CreateUser`, then sign-in). Each resolves once a session exists.
 */
export interface AuthProvider {
  signInWithGoogle(): Promise<AuthUser>;
  signInWithPassword(email: string, password: string): Promise<AuthUser>;
  signUp(name: string, email: string, password: string): Promise<AuthUser>;
  signOut(): Promise<void>;
  currentUser(): AuthUser | null;
  /** Re-store the session user after a profile update. */
  setCurrentUser(user: AuthUser): void;
}
