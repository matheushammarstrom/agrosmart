import { responder } from "@/lib/dados";

export const maxDuration = 60;

export function GET(request: Request) {
  return responder("alertas", request);
}
