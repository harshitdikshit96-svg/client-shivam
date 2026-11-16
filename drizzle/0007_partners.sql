CREATE TABLE "partners" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"logo" text,
	"description" text,
	"cost" numeric(12, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_cost_non_negative" CHECK ("partners"."cost" IS NULL OR "partners"."cost" >= 0),
	CONSTRAINT "partner_logo_is_image" CHECK ("partners"."logo" IS NULL OR "partners"."logo" LIKE 'data:image/%')
);
