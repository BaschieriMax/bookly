import type { AxiosResponse } from 'axios'

/**
 * Saves a file the API sent as a blob, with the name from Content-Disposition when present,
 * through a temporary object URL.
 */
export function saveDownloadedFile(response: AxiosResponse<Blob>, fallbackName: string): void {
  const disposition = String(response.headers['content-disposition'] ?? '')
  const name = /filename="?([^";]+)"?/.exec(disposition)?.[1] ?? fallbackName
  const url = URL.createObjectURL(response.data)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
