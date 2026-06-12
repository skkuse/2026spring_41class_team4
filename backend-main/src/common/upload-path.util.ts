import { isAbsolute, join, resolve } from 'node:path';

export function resolveUploadRoot(uploadRootEnv?: string): string {
  const raw = uploadRootEnv?.trim();
  if (!raw) {
    return join(process.cwd(), 'uploads');
  }
  return isAbsolute(raw) ? raw : resolve(process.cwd(), raw);
}
