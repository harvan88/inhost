CREATE TABLE "mentions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"mentioned_user_id" uuid NOT NULL,
	"mentioned_by_user_id" uuid NOT NULL,
	"entity_type" varchar NOT NULL,
	"entity_id" uuid NOT NULL,
	"mention_type" varchar DEFAULT 'user',
	"context" text,
	"is_read" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "message_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"message_id" uuid NOT NULL,
	"given_by_user_id" uuid NOT NULL,
	"rating" varchar,
	"comment" text,
	"suggested_correction" text,
	"extension_id" varchar(100),
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "mentions" ADD CONSTRAINT "mentions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentions" ADD CONSTRAINT "mentions_mentioned_user_id_admin_users_id_fk" FOREIGN KEY ("mentioned_user_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentions" ADD CONSTRAINT "mentions_mentioned_by_user_id_admin_users_id_fk" FOREIGN KEY ("mentioned_by_user_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_feedback" ADD CONSTRAINT "message_feedback_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_feedback" ADD CONSTRAINT "message_feedback_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_feedback" ADD CONSTRAINT "message_feedback_given_by_user_id_admin_users_id_fk" FOREIGN KEY ("given_by_user_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mentions_tenant_id_idx" ON "mentions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "mentions_mentioned_user_id_idx" ON "mentions" USING btree ("mentioned_user_id");--> statement-breakpoint
CREATE INDEX "mentions_entity_type_id_idx" ON "mentions" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "mentions_is_read_idx" ON "mentions" USING btree ("is_read");--> statement-breakpoint
CREATE INDEX "message_feedback_tenant_id_idx" ON "message_feedback" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "message_feedback_message_id_idx" ON "message_feedback" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "message_feedback_extension_id_idx" ON "message_feedback" USING btree ("extension_id");--> statement-breakpoint
CREATE INDEX "message_feedback_rating_idx" ON "message_feedback" USING btree ("rating");--> statement-breakpoint
CREATE INDEX "message_feedback_given_by_user_id_idx" ON "message_feedback" USING btree ("given_by_user_id");