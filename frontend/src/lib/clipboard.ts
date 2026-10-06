import { toast } from 'sonner'

export async function copyText(text: string, label = 'Copied to clipboard') {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(label)
    return true
  } catch {
    toast.error("Couldn't copy", {
      description: 'Your browser blocked clipboard access. Select the text and copy it manually.',
    })
    return false
  }
}
