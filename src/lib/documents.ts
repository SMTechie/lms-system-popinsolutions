import { apiRequest, tokenStorage } from './api';

export async function uploadDocument(file: File) {
  if (file.size > 5 * 1024 * 1024) throw new Error('Files must be 5 MB or smaller.');
  const contentBase64 = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
  return apiRequest<{ id: string; name: string }>('/documents', { method: 'POST', body: JSON.stringify({ name: file.name, mimeType: file.type, contentBase64 }) });
}

export async function downloadDocument(id: string, name: string) {
  const token = tokenStorage.get();
  const response = await fetch(`/api/documents/${encodeURIComponent(id)}`, { headers: token && token !== 'cookie' ? { Authorization: `Bearer ${token}` } : {} });
  if (!response.ok) throw new Error('Unable to download this document.');
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
