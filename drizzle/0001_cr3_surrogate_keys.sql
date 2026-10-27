ALTER TABLE "firms" DROP CONSTRAINT "pincode_6_digits";--> statement-breakpoint
ALTER TABLE "workmen" DROP CONSTRAINT "aadhaar_12_digits";--> statement-breakpoint
ALTER TABLE "workmen" DROP CONSTRAINT "nominee_aadhaar_12_digits";--> statement-breakpoint
DROP INDEX "aadhaar_per_firm";--> statement-breakpoint
ALTER TABLE "work_order_rates" DROP CONSTRAINT "work_order_rates_work_order_id_skill_category_pk";--> statement-breakpoint
-- the 1:1 Config used its work order id as primary key; it gets its own id (Postgres default pk name)
ALTER TABLE "work_order_config" DROP CONSTRAINT "work_order_config_pkey";--> statement-breakpoint
ALTER TABLE "workmen" ALTER COLUMN "aadhaar" SET DATA TYPE varchar(20);--> statement-breakpoint
ALTER TABLE "workmen" ALTER COLUMN "nominee_aadhaar" SET DATA TYPE varchar(20);--> statement-breakpoint
ALTER TABLE "work_order_config" ADD COLUMN "id" serial PRIMARY KEY NOT NULL;--> statement-breakpoint
ALTER TABLE "work_order_rates" ADD COLUMN "id" serial PRIMARY KEY NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "one_rate_per_skill" ON "work_order_rates" USING btree ("work_order_id","skill_category");--> statement-breakpoint
CREATE INDEX "workmen_aadhaar_idx" ON "workmen" USING btree ("firm_id","aadhaar");--> statement-breakpoint
ALTER TABLE "work_order_config" ADD CONSTRAINT "work_order_config_work_order_id_unique" UNIQUE("work_order_id");