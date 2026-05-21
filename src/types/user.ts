export type AccountStatus =
  | 'pending_identity'
  | 'active'
  | 'suspended'
  | 'disabled'
  | 'failed';

export type Role = 'ADMIN' | 'EDITOR' | 'VIEWER';

export interface User {
  id:            string;
  keycloakId:    string;
  email:         string;
  fullName:      string | null;
  displayName:   string | null;
  accountStatus: AccountStatus;
  roles:         Role[];
  createdAt:     string;
  updatedAt:     string;
}

export interface UserListResult {
  items:  User[];
  total:  number;
  limit:  number;
  offset: number;
}

export interface AdminCreateUserPayload {
  email:       string;
  fullName?:   string;
  displayName?: string;
  password:    string;
  roles:       Role[];
}
