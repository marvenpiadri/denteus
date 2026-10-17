import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  // Client generation can run in CI without database credentials.
  // Migration commands still require DATABASE_URL at execution time.
  datasource: { url: process.env["DATABASE_URL"] ?? "" },
});
