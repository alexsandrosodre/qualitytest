import { randomUUID } from 'node:crypto';

import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import {
  sanitizeFileName,
  type DownloadTarget,
  type StorageService,
  type UploadTarget,
} from './storage.service';

export interface S3StorageConfig {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
}

/**
 * Adaptador de storage sobre S3 (ou serviço compatível, ex.: MinIO).
 * Usa URLs pré-assinadas com expiração (seção 14). Não trafega credenciais
 * ao cliente: apenas a URL assinada e a chave do objeto.
 */
export class S3StorageService implements StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: S3StorageConfig) {
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      // Necessário para MinIO e outros compatíveis que usam path-style.
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
    this.bucket = config.bucket;
  }

  buildStorageKey(occurrenceId: string, fileName: string): string {
    return `occurrences/${occurrenceId}/${randomUUID()}-${sanitizeFileName(fileName)}`;
  }

  async createUploadUrl(input: {
    storageKey: string;
    mimeType: string;
    expiresInSeconds: number;
  }): Promise<UploadTarget> {
    const uploadUrl = await getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.storageKey,
        ContentType: input.mimeType,
      }),
      { expiresIn: input.expiresInSeconds },
    );

    return { storageKey: input.storageKey, uploadUrl, expiresInSeconds: input.expiresInSeconds };
  }

  async createDownloadUrl(input: {
    storageKey: string;
    expiresInSeconds: number;
  }): Promise<DownloadTarget> {
    const downloadUrl = await getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: input.storageKey }),
      { expiresIn: input.expiresInSeconds },
    );

    return { downloadUrl, expiresInSeconds: input.expiresInSeconds };
  }
}
