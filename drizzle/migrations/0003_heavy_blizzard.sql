CREATE TABLE "message_enrichments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"extension_id" varchar(100) NOT NULL,
	"type" varchar NOT NULL,
	"payload" jsonb NOT NULL,
	"confidence" real,
	"processing_time_ms" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "message_reads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"read_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "last_message_id" uuid;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "last_message_text" text;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "last_message_type" varchar(50);--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "last_message_at" timestamp;--> statement-breakpoint
ALTER TABLE "message_enrichments" ADD CONSTRAINT "message_enrichments_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_enrichments" ADD CONSTRAINT "message_enrichments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_reads" ADD CONSTRAINT "message_reads_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_reads" ADD CONSTRAINT "message_reads_user_id_admin_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "message_enrichments_message_id_idx" ON "message_enrichments" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "message_enrichments_tenant_id_idx" ON "message_enrichments" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "message_enrichments_extension_id_idx" ON "message_enrichments" USING btree ("extension_id");--> statement-breakpoint
CREATE INDEX "message_enrichments_type_idx" ON "message_enrichments" USING btree ("type");--> statement-breakpoint
CREATE INDEX "message_enrichments_message_type_idx" ON "message_enrichments" USING btree ("message_id","type");--> statement-breakpoint
CREATE INDEX "message_reads_message_id_idx" ON "message_reads" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "message_reads_user_id_idx" ON "message_reads" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "message_reads_composite_idx" ON "message_reads" USING btree ("message_id","user_id");--> statement-breakpoint
CREATE INDEX "message_reads_message_user_unique" ON "message_reads" USING btree ("message_id","user_id");