ALTER TABLE "dispatch_register" ADD COLUMN "tax_rate" numeric(5, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "dispatch_register" ADD COLUMN "tax_amount" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "dispatch_register" ADD COLUMN "gst_rate" numeric(5, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "dispatch_register" ADD COLUMN "total_amount" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
-- bills entered before CR-7 had a typed GST amount: derive their GST rate from it, and their total
UPDATE "dispatch_register" SET "gst_rate" = CASE WHEN "taxable_amount" > 0 THEN LEAST(100, ROUND("gst_amount" * 100 / "taxable_amount", 2)) ELSE 0 END, "total_amount" = "taxable_amount" + "tax_amount" + "gst_amount";--> statement-breakpoint
ALTER TABLE "dispatch_register" ADD CONSTRAINT "bill_tax_amounts_non_negative" CHECK ("dispatch_register"."tax_amount" >= 0 AND "dispatch_register"."total_amount" >= 0);--> statement-breakpoint
ALTER TABLE "dispatch_register" ADD CONSTRAINT "bill_rates_percent" CHECK ("dispatch_register"."tax_rate" BETWEEN 0 AND 100 AND "dispatch_register"."gst_rate" BETWEEN 0 AND 100);