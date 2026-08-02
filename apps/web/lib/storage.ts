/**
 * Cliente Cloudflare R2 (compatível S3). Só o servidor usa — o binário
 * original de PDF/DOCX/planilha nunca chega ao browser em claro; a UI recebe
 * uma URL assinada e o browser vai direto no R2.
 *
 * Configuração via env:
 *   R2_ACCOUNT_ID
 *   R2_ACCESS_KEY_ID
 *   R2_SECRET_ACCESS_KEY
 *   R2_BUCKET
 *
 * Se qualquer um faltar, isStorageConfigured() volta false e as funções viram
 * no-op — a extração de texto continua funcionando, só o "baixar original"
 * fica indisponível. Isso mantém o dev local sem R2 usável.
 */

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

let _client: S3Client | undefined;

export function isStorageConfigured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET,
  );
}

export function getBucket(): string {
  const b = process.env.R2_BUCKET;
  if (!b) throw new Error("R2_BUCKET not configured");
  return b;
}

function getClient(): S3Client {
  if (_client) return _client;
  if (!isStorageConfigured()) {
    throw new Error("R2 storage not configured");
  }
  _client = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
  return _client;
}

/** Escapa nome de arquivo para uso seguro em chave S3 (sem traversal). */
export function sanitizeFilename(name: string): string {
  return name
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 100);
}

/**
 * Chave padronizada: attachments/<orgId>/<conversationId>/<attId>-<filename>.
 * O orgId no prefixo torna trivial aplicar policy R2 por prefixo se precisar,
 * e o attId no final elimina colisão entre uploads do mesmo arquivo.
 */
export function buildKey(orgId: string, conversationId: string, attId: string, filename: string): string {
  return `attachments/${orgId}/${conversationId}/${attId}-${sanitizeFilename(filename)}`;
}

export async function putObject(params: {
  key: string;
  body: Buffer;
  contentType: string;
  originalFilename: string;
}): Promise<void> {
  await getClient().send(new PutObjectCommand({
    Bucket: getBucket(),
    Key: params.key,
    Body: params.body,
    ContentType: params.contentType,
    // Content-Disposition preserva o nome original ao baixar via signed URL.
    ContentDisposition: `attachment; filename="${sanitizeFilename(params.originalFilename)}"`,
  }));
}

export async function getSignedDownloadUrl(key: string, expiresInSeconds = 300): Promise<string> {
  return getSignedUrl(
    getClient(),
    new GetObjectCommand({ Bucket: getBucket(), Key: key }),
    { expiresIn: expiresInSeconds },
  );
}

export async function deleteObject(key: string): Promise<void> {
  if (!isStorageConfigured()) return;
  await getClient().send(new DeleteObjectCommand({ Bucket: getBucket(), Key: key }));
}
