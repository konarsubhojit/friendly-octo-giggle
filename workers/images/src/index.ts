import { handleImageRequest, type Env } from './handler'

export type { Env } from './handler'

const worker = {
  fetch: (request: Request, env: Env): Promise<Response> =>
    handleImageRequest(request, env),
}

export default worker
