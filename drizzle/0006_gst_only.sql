ALTER TABLE "dispatch_register" DROP CONSTRAINT "bill_tax_amounts_non_negative";--> statement-breakpoint
ALTER TABLE "dispatch_register" DROP CONSTRAINT "bill_rates_percent";--> statement-breakpoint
-- CR-11: one tax only (GST). A bill saved with a Tax Rate keeps its total: the tax is folded into its GST
UPDATE "dispatch_register" SET "gst_rate" = LEAST(100, "gst_rate" + "tax_rate"), "gst_amount" = "gst_amount" + "tax_amount", "total_amount" = "taxable_amount" + "gst_amount" + "tax_amount" WHERE "tax_rate" <> 0 OR "tax_amount" <> 0;--> statement-breakpoint
ALTER TABLE "dispatch_register" DROP COLUMN "tax_rate";--> statement-breakpoint
ALTER TABLE "dispatch_register" DROP COLUMN "tax_amount";--> statement-breakpoint
ALTER TABLE "dispatch_register" ADD CONSTRAINT "bill_total_non_negative" CHECK ("dispatch_register"."total_amount" >= 0);--> statement-breakpoint
ALTER TABLE "dispatch_register" ADD CONSTRAINT "bill_gst_rate_percent" CHECK ("dispatch_register"."gst_rate" BETWEEN 0 AND 100);