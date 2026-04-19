export type DocumentState =
  | 'RECEIVED'
  | 'PERSISTING'
  | 'AVAILABLE'
  | 'UPDATING'
  | 'ARCHIVED'
  | 'DELETED'
  | 'FAILED';

export type PayloadEngine = 'mongo' | 'minio';
export type StorageTier   = 'hot' | 'cold';

export interface Document {
  id:            string;
  documentId:    string;
  ownerId:       string;
  title:         string;
  state:         DocumentState;
  payloadEngine: PayloadEngine;
  storageTier:   StorageTier;
  mimeType:      string | null;
  sizeBytes:     number | null;
  version:       number;
  tags:          string[];
  createdAt:     string;
  updatedAt:     string;
}

export interface DocumentListResponse {
  items:  Document[];
  total:  number;
  limit:  number;
  offset: number;
}

export interface UploadDocumentInput {
  file:           File;
  title:          string;
  mimeType?:      string;
  tags?:          string[];
  payloadEngine?: PayloadEngine;
}
