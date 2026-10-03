/**
 * Account — `proto.UserService`. Sign-in is Google (`GoogleAuth`) or email
 * + password (`GetUser`); sign-up is `CreateUser` (email + password only —
 * Google accounts are created on first Google sign-in).
 */

export interface User {
  id: string;
  name: string;
  email: string;
}

/** UpdateUserRequest — empty fields are left unchanged server-side. */
export interface ProfilePatch {
  name?: string;
  email?: string;
  password?: string;
}
