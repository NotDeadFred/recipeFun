import { handleImport } from "@/lib/server/handlers";

export async function POST(request: Request) {
  return handleImport(request);
}
