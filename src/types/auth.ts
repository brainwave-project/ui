export interface TokenResponse {
  access_token:   string;
  refresh_token:  string;
  expires_in:     number;
  token_type:     string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthUser {
  sub:   string;   // Keycloak user ID
  email: string;
  roles: string[];
  exp:   number;
}

export interface SetPasswordRequest {
  username:     string;
  new_password: string;
}
