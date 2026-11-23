import { handleGenerate } from "@/lib/server/handlers";

export async function POST(request: Request) {
  return handleGenerate(request);
}
