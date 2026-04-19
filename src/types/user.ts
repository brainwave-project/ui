export type AccountStatus =
  | 'pending_identity'
  | 'active'
  | 'suspended'
  | 'deactivated';

export type Role = 'ADMIN' | 'EDITOR' | 'VIEWER';

export interface User {
  id:            string;
  keycloakId:    string;
  email:         string;
  fullName:      string | null;
  displayName:   string | null;
  accountStatus: AccountStatus;
  roles:         string[];
  createdAt:     string;
  updatedAt:     string;
}
