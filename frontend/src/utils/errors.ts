export function getApiMessage(error: unknown) {
  return error instanceof Error ? error.message : 'خطایی رخ داد. دوباره تلاش کنید.'
}
