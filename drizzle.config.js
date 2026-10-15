// drizzle-kit: `npm run db:generate` writes SQL migrations to ./drizzle from db/schema.js
export default {
  dialect: "postgresql",
  schema: "./db/schema.js",
  out: "./drizzle",
  strict: true,
};
