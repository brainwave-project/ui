export interface AuditActor {
  userId: string;
  email:  string | null;
  roles:  string[];
}

export interface AuditResource {
  type: string | null;
  id:   string;
  name: string | null;
}

export interface AuditEvent {
  id:            string;
  eventId:       string;
  occurredAt:    string;
  actor:         AuditActor;
  action:        string;
  service:       string;
  resource:      AuditResource | null;
  outcome:       'SUCCESS' | 'FAILURE';
  correlationId: string | null;
  metadata:      Record<string, unknown> | null;
}

export interface AuditPage {
  items:  AuditEvent[];
  total:  number;
  limit:  number;
  offset: number;
}

export interface AuditQuery {
  limit?:   number;
  offset?:  number;
  action?:  string;
  service?: string;
  outcome?: 'SUCCESS' | 'FAILURE';
  from?:    string;
  to?:      string;
  userId?:  string;
}
