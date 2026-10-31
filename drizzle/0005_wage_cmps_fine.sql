ALTER TABLE "wage_lines" ADD COLUMN "cmps_deduction" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "wage_lines" ADD COLUMN "fine" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "wage_lines" ADD CONSTRAINT "cmps_fine_non_negative" CHECK ("wage_lines"."cmps_deduction" >= 0 AND "wage_lines"."fine" >= 0);