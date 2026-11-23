import { handleStructure } from "@/lib/server/handlers";

export async function POST(request: Request) {
  return handleStructure(request);
}
