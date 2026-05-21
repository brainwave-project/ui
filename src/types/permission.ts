export interface Permission {
  id:          string;
  name:        string;        // "document:read"
  description: string | null;
  resource:    string;        // "document"
  action:      string;        // "read"
  createdAt:   string;
}

export interface RoleWithPermissions {
  id:          string;
  name:        string;        // "ADMIN"
  description: string | null;
  permissions: Permission[];
  createdAt:   string;
}
