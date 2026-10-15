CREATE TYPE "public"."accommodation" AS ENUM('Self', 'Company Quarter', 'Contractors'' camp');--> statement-breakpoint
CREATE TYPE "public"."area_of_operation" AS ENUM('Surface', 'Under ground');--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('Male', 'Female', 'Others');--> statement-breakpoint
CREATE TYPE "public"."nationality" AS ENUM('Indian', 'Other');--> statement-breakpoint
CREATE TYPE "public"."nature_of_work" AS ENUM('Coal Loading and Transportation', 'MDO', 'Mining Activities', 'Civil', 'E & M', 'Watch and Ward', 'Others');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('Pending', 'Paid', 'Partially Paid', 'Not Applicable');--> statement-breakpoint
CREATE TYPE "public"."pf_type" AS ENUM('CMPF', 'EPF');--> statement-breakpoint
CREATE TYPE "public"."religion" AS ENUM('Hinduism', 'Islam', 'Christianity', 'Sikhism', 'Buddhism', 'Jainism', 'Other');--> statement-breakpoint
CREATE TYPE "public"."sheet_status" AS ENUM('draft', 'submitted', 'approved');--> statement-breakpoint
CREATE TYPE "public"."skill_category" AS ENUM('Highly Skilled', 'Skilled', 'Semi Skilled', 'Unskilled');--> statement-breakpoint
CREATE TYPE "public"."wage_category" AS ENUM('HPC', 'Minimum Wages', 'DGR', 'Other');--> statement-breakpoint
CREATE TYPE "public"."wo_status" AS ENUM('pending', 'approved', 'rejected', 'completed');--> statement-breakpoint
CREATE TABLE "app_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" varchar(64) NOT NULL,
	"password_hash" text NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "dispatch_register" (
	"id" serial PRIMARY KEY NOT NULL,
	"firm_id" integer NOT NULL,
	"work_order_id" integer,
	"party_name_contract" text NOT NULL,
	"bill_number" varchar(64) NOT NULL,
	"bill_date" date NOT NULL,
	"taxable_amount" numeric(12, 2) NOT NULL,
	"gst_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"received_amount" numeric(12, 2),
	"received_date" date,
	"deduction" numeric(12, 2) DEFAULT '0' NOT NULL,
	"remark" text,
	"gst_payment_status" "payment_status" DEFAULT 'Pending' NOT NULL,
	"epf_payment_status" "payment_status" DEFAULT 'Pending' NOT NULL,
	"esic_payment_status" "payment_status" DEFAULT 'Pending' NOT NULL,
	"approved" boolean DEFAULT false NOT NULL,
	"approved_by" text,
	"approval_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bill_amounts_non_negative" CHECK ("dispatch_register"."taxable_amount" >= 0 AND "dispatch_register"."gst_amount" >= 0 AND "dispatch_register"."deduction" >= 0),
	CONSTRAINT "received_date_with_amount" CHECK ("dispatch_register"."received_amount" IS NULL OR "dispatch_register"."received_date" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "engagements" (
	"id" serial PRIMARY KEY NOT NULL,
	"firm_id" integer NOT NULL,
	"workman_id" integer NOT NULL,
	"work_order_id" integer NOT NULL,
	"engaged_from" date NOT NULL,
	"engaged_to" date,
	"appointment_letter_path" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "engagement_dates_in_order" CHECK ("engagements"."engaged_to" IS NULL OR "engagements"."engaged_to" >= "engagements"."engaged_from")
);
--> statement-breakpoint
CREATE TABLE "firms" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"cuin" varchar(32),
	"registration_no" text,
	"gstin" varchar(15),
	"pan" varchar(10),
	"pf_registration_no" varchar(32),
	"esic_no" varchar(32),
	"mobile" varchar(15),
	"email" text,
	"state" text,
	"address" text,
	"pincode" varchar(6),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "firms_name_unique" UNIQUE("name"),
	CONSTRAINT "firms_cuin_unique" UNIQUE("cuin"),
	CONSTRAINT "pincode_6_digits" CHECK ("firms"."pincode" IS NULL OR "firms"."pincode" ~ '^[0-9]{6}$')
);
--> statement-breakpoint
CREATE TABLE "monthly_sheets" (
	"id" serial PRIMARY KEY NOT NULL,
	"work_order_id" integer NOT NULL,
	"year" smallint NOT NULL,
	"month" smallint NOT NULL,
	"status" "sheet_status" DEFAULT 'draft' NOT NULL,
	"submitted_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"deadline" date,
	"proof_of_wage_pf_path" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "month_1_to_12" CHECK ("monthly_sheets"."month" BETWEEN 1 AND 12),
	CONSTRAINT "year_sane" CHECK ("monthly_sheets"."year" BETWEEN 2020 AND 2100)
);
--> statement-breakpoint
CREATE TABLE "wage_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"sheet_id" integer NOT NULL,
	"workman_id" integer NOT NULL,
	"days_worked" numeric(4, 1) NOT NULL,
	"ot_hours" smallint DEFAULT 0 NOT NULL,
	"ot_minutes" smallint DEFAULT 0 NOT NULL,
	"ug_allowance" numeric(12, 2) DEFAULT '0' NOT NULL,
	"bonus" numeric(12, 2) DEFAULT '0' NOT NULL,
	"edlis" numeric(12, 2) DEFAULT '0' NOT NULL,
	"pli" numeric(12, 2) DEFAULT '0' NOT NULL,
	"other_earnings" numeric(12, 2) DEFAULT '0' NOT NULL,
	"other_deduction" numeric(12, 2) DEFAULT '0' NOT NULL,
	"damage_recovery" numeric(12, 2) DEFAULT '0' NOT NULL,
	"remarks" text,
	"skill_category" "skill_category" NOT NULL,
	"basic_rate" numeric(12, 2) NOT NULL,
	"vda_rate" numeric(12, 2) NOT NULL,
	"epf_percent" numeric(5, 2) NOT NULL,
	"esi_percent" numeric(5, 2) NOT NULL,
	"ot_multiplier" numeric(4, 2) NOT NULL,
	"basic_vda_earned" numeric(12, 2) NOT NULL,
	"ot_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"gross_earnings" numeric(12, 2) NOT NULL,
	"epf_deduction" numeric(12, 2) NOT NULL,
	"esi_deduction" numeric(12, 2) NOT NULL,
	"total_deduction" numeric(12, 2) NOT NULL,
	"net_earnings" numeric(12, 2) NOT NULL,
	"calculated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "days_0_to_31" CHECK ("wage_lines"."days_worked" >= 0 AND "wage_lines"."days_worked" <= 31),
	CONSTRAINT "ot_hours_non_negative" CHECK ("wage_lines"."ot_hours" >= 0),
	CONSTRAINT "ot_minutes_quarter_hours" CHECK ("wage_lines"."ot_minutes" IN (0, 15, 30, 45)),
	CONSTRAINT "net_is_gross_minus_deductions" CHECK ("wage_lines"."net_earnings" = "wage_lines"."gross_earnings" - "wage_lines"."total_deduction"),
	CONSTRAINT "extras_non_negative" CHECK ("wage_lines"."ug_allowance" >= 0 AND "wage_lines"."bonus" >= 0 AND "wage_lines"."edlis" >= 0 AND "wage_lines"."pli" >= 0 AND "wage_lines"."other_earnings" >= 0 AND "wage_lines"."other_deduction" >= 0 AND "wage_lines"."damage_recovery" >= 0)
);
--> statement-breakpoint
CREATE TABLE "work_order_config" (
	"work_order_id" integer PRIMARY KEY NOT NULL,
	"epf_percent" numeric(5, 2) DEFAULT '12' NOT NULL,
	"epf_wage_ceiling" numeric(12, 2),
	"esi_percent" numeric(5, 2) DEFAULT '0.75' NOT NULL,
	"esi_gross_ceiling" numeric(12, 2) DEFAULT '21000',
	"ot_multiplier" numeric(4, 2) DEFAULT '2' NOT NULL,
	"hours_per_day" smallint DEFAULT 8 NOT NULL,
	"deadline_day" smallint,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "config_percents_sane" CHECK ("work_order_config"."epf_percent" BETWEEN 0 AND 100 AND "work_order_config"."esi_percent" BETWEEN 0 AND 100),
	CONSTRAINT "config_ot_sane" CHECK ("work_order_config"."ot_multiplier" >= 1 AND "work_order_config"."hours_per_day" BETWEEN 1 AND 24),
	CONSTRAINT "config_deadline_day" CHECK ("work_order_config"."deadline_day" IS NULL OR "work_order_config"."deadline_day" BETWEEN 1 AND 31)
);
--> statement-breakpoint
CREATE TABLE "work_order_rates" (
	"work_order_id" integer NOT NULL,
	"skill_category" "skill_category" NOT NULL,
	"basic_daily" numeric(12, 2) NOT NULL,
	"vda_daily" numeric(12, 2) DEFAULT '0' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "work_order_rates_work_order_id_skill_category_pk" PRIMARY KEY("work_order_id","skill_category"),
	CONSTRAINT "rate_positive" CHECK ("work_order_rates"."basic_daily" > 0 AND "work_order_rates"."vda_daily" >= 0)
);
--> statement-breakpoint
CREATE TABLE "work_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"firm_id" integer NOT NULL,
	"wo_number" varchar(64) NOT NULL,
	"wouin" varchar(32),
	"party_gst" varchar(15),
	"name_of_work" text NOT NULL,
	"company" text NOT NULL,
	"area_unit" text,
	"principal_employer_name" text NOT NULL,
	"principal_employer_designation" text NOT NULL,
	"principal_employer_address" text,
	"principal_employer_contact" text NOT NULL,
	"state" text NOT NULL,
	"district" text NOT NULL,
	"nature_of_work" "nature_of_work",
	"area_of_operation" "area_of_operation",
	"commencement_date" date NOT NULL,
	"completion_date" date NOT NULL,
	"engineer_in_charge" text,
	"supervisor_name" text,
	"supervisor_phone" varchar(20),
	"supervisor_phone_alt" varchar(20),
	"supervisor_email" text,
	"supervisor_email_alt" text,
	"labour_license_path" text,
	"remarks" text,
	"status" "wo_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "work_orders_firm_id_id" UNIQUE("firm_id","id"),
	CONSTRAINT "wo_dates_in_order" CHECK ("work_orders"."completion_date" >= "work_orders"."commencement_date")
);
--> statement-breakpoint
CREATE TABLE "workmen" (
	"id" serial PRIMARY KEY NOT NULL,
	"firm_id" integer NOT NULL,
	"wuin" varchar(32) NOT NULL,
	"aadhaar" char(12) NOT NULL,
	"name" text NOT NULL,
	"surname" text,
	"gender" "gender" NOT NULL,
	"relative_name" text NOT NULL,
	"date_of_birth" date NOT NULL,
	"nationality" "nationality" DEFAULT 'Indian' NOT NULL,
	"education_level" text,
	"date_of_joining" date NOT NULL,
	"designation" text NOT NULL,
	"skill_category" "skill_category" NOT NULL,
	"employment_type" text,
	"mobile" varchar(15),
	"pf_type" "pf_type" NOT NULL,
	"uan_or_cmpf_no" varchar(20),
	"group_insurance_no" varchar(30),
	"pan" varchar(10),
	"esic_ip" varchar(20),
	"bank_account_no" varchar(20) NOT NULL,
	"bank_name" text,
	"ifsc" varchar(11),
	"address" text NOT NULL,
	"date_of_exit" date,
	"identification_mark" text,
	"is_disabled" boolean DEFAULT false NOT NULL,
	"disability_details" text,
	"religion" "religion",
	"is_ex_serviceman" boolean DEFAULT false NOT NULL,
	"accommodation" "accommodation" NOT NULL,
	"wage_category" "wage_category",
	"nominee_name" text,
	"nominee_relationship" text,
	"nominee_dob" date,
	"nominee_aadhaar" char(12),
	"emergency_contact_name" text,
	"emergency_contact_address" text,
	"emergency_contact_phone" varchar(15),
	"photo_path" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workmen_firm_id_id" UNIQUE("firm_id","id"),
	CONSTRAINT "aadhaar_12_digits" CHECK ("workmen"."aadhaar" ~ '^[0-9]{12}$'),
	CONSTRAINT "nominee_aadhaar_12_digits" CHECK ("workmen"."nominee_aadhaar" IS NULL OR "workmen"."nominee_aadhaar" ~ '^[0-9]{12}$'),
	CONSTRAINT "exit_after_joining" CHECK ("workmen"."date_of_exit" IS NULL OR "workmen"."date_of_exit" >= "workmen"."date_of_joining")
);
--> statement-breakpoint
ALTER TABLE "dispatch_register" ADD CONSTRAINT "dispatch_register_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispatch_register" ADD CONSTRAINT "dispatch_register_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagements" ADD CONSTRAINT "engagement_workman_same_firm" FOREIGN KEY ("firm_id","workman_id") REFERENCES "public"."workmen"("firm_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagements" ADD CONSTRAINT "engagement_work_order_same_firm" FOREIGN KEY ("firm_id","work_order_id") REFERENCES "public"."work_orders"("firm_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_sheets" ADD CONSTRAINT "monthly_sheets_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wage_lines" ADD CONSTRAINT "wage_lines_sheet_id_monthly_sheets_id_fk" FOREIGN KEY ("sheet_id") REFERENCES "public"."monthly_sheets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wage_lines" ADD CONSTRAINT "wage_lines_workman_id_workmen_id_fk" FOREIGN KEY ("workman_id") REFERENCES "public"."workmen"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_config" ADD CONSTRAINT "work_order_config_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_rates" ADD CONSTRAINT "work_order_rates_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workmen" ADD CONSTRAINT "workmen_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bill_number_per_firm" ON "dispatch_register" USING btree ("firm_id","bill_number");--> statement-breakpoint
CREATE INDEX "dispatch_register_bill_date_idx" ON "dispatch_register" USING btree ("firm_id","bill_date");--> statement-breakpoint
CREATE UNIQUE INDEX "one_open_engagement_per_workman" ON "engagements" USING btree ("workman_id") WHERE "engagements"."engaged_to" IS NULL;--> statement-breakpoint
CREATE INDEX "engagements_work_order_idx" ON "engagements" USING btree ("work_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "one_sheet_per_work_order_month" ON "monthly_sheets" USING btree ("work_order_id","year","month");--> statement-breakpoint
CREATE UNIQUE INDEX "one_wage_line_per_workman" ON "wage_lines" USING btree ("sheet_id","workman_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wo_number_per_firm" ON "work_orders" USING btree ("firm_id","wo_number");--> statement-breakpoint
CREATE INDEX "work_orders_status_idx" ON "work_orders" USING btree ("firm_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "wuin_per_firm" ON "workmen" USING btree ("firm_id","wuin");--> statement-breakpoint
CREATE UNIQUE INDEX "aadhaar_per_firm" ON "workmen" USING btree ("firm_id","aadhaar");