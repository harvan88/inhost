CREATE TABLE "admin_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"role" varchar DEFAULT 'agent',
	"is_active" boolean DEFAULT true,
	"last_login_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "admin_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"end_user_id" uuid NOT NULL,
	"channel" varchar NOT NULL,
	"status" varchar DEFAULT 'active',
	"assigned_to_id" uuid,
	"is_pinned" boolean DEFAULT false,
	"unread_count" integer DEFAULT 0,
	"last_read_at" timestamp,
	"last_message_id" uuid,
	"last_message_text" text,
	"last_message_type" varchar(50),
	"last_message_at" timestamp,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"closed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "end_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"channel" varchar NOT NULL,
	"name" varchar(255),
	"email" varchar(255),
	"phone" varchar(50),
	"avatar_url" varchar(500),
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"is_blocked" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
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
CREATE TABLE "message_enrichments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"tenant_id" varchar(100) DEFAULT 'default' NOT NULL,
	"extension_id" varchar(100) NOT NULL,
	"type" varchar NOT NULL,
	"payload" jsonb NOT NULL,
	"confidence" real,
	"processing_time_ms" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"expires_at" timestamp
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
CREATE TABLE "message_reads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"read_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"type" varchar NOT NULL,
	"channel" varchar NOT NULL,
	"content" jsonb NOT NULL,
	"metadata" jsonb NOT NULL,
	"status_chain" jsonb DEFAULT '[]'::jsonb,
	"context" jsonb NOT NULL,
	"sent_by_admin_user_id" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"plan" varchar DEFAULT 'starter',
	"settings" jsonb DEFAULT '{}'::jsonb,
	"stripe_customer_id" varchar(255),
	"subscription_status" varchar(50) DEFAULT 'trialing',
	"trial_ends_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_end_user_id_end_users_id_fk" FOREIGN KEY ("end_user_id") REFERENCES "public"."end_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_assigned_to_id_admin_users_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "end_users" ADD CONSTRAINT "end_users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentions" ADD CONSTRAINT "mentions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentions" ADD CONSTRAINT "mentions_mentioned_user_id_admin_users_id_fk" FOREIGN KEY ("mentioned_user_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentions" ADD CONSTRAINT "mentions_mentioned_by_user_id_admin_users_id_fk" FOREIGN KEY ("mentioned_by_user_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_enrichments" ADD CONSTRAINT "message_enrichments_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_feedback" ADD CONSTRAINT "message_feedback_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_feedback" ADD CONSTRAINT "message_feedback_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_feedback" ADD CONSTRAINT "message_feedback_given_by_user_id_admin_users_id_fk" FOREIGN KEY ("given_by_user_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_reads" ADD CONSTRAINT "message_reads_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_reads" ADD CONSTRAINT "message_reads_user_id_admin_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sent_by_admin_user_id_admin_users_id_fk" FOREIGN KEY ("sent_by_admin_user_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_users_tenant_id_idx" ON "admin_users" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "admin_users_email_idx" ON "admin_users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "conversations_tenant_id_idx" ON "conversations" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "conversations_end_user_id_idx" ON "conversations" USING btree ("end_user_id");--> statement-breakpoint
CREATE INDEX "conversations_status_idx" ON "conversations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "conversations_assigned_to_id_idx" ON "conversations" USING btree ("assigned_to_id");--> statement-breakpoint
CREATE INDEX "end_users_tenant_id_idx" ON "end_users" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "end_users_external_id_idx" ON "end_users" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "end_users_channel_idx" ON "end_users" USING btree ("channel");--> statement-breakpoint
CREATE INDEX "mentions_tenant_id_idx" ON "mentions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "mentions_mentioned_user_id_idx" ON "mentions" USING btree ("mentioned_user_id");--> statement-breakpoint
CREATE INDEX "mentions_entity_type_id_idx" ON "mentions" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "mentions_is_read_idx" ON "mentions" USING btree ("is_read");--> statement-breakpoint
CREATE INDEX "message_enrichments_message_id_idx" ON "message_enrichments" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "message_enrichments_tenant_id_idx" ON "message_enrichments" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "message_enrichments_extension_id_idx" ON "message_enrichments" USING btree ("extension_id");--> statement-breakpoint
CREATE INDEX "message_enrichments_type_idx" ON "message_enrichments" USING btree ("type");--> statement-breakpoint
CREATE INDEX "message_enrichments_message_type_idx" ON "message_enrichments" USING btree ("message_id","type");--> statement-breakpoint
CREATE INDEX "message_feedback_tenant_id_idx" ON "message_feedback" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "message_feedback_message_id_idx" ON "message_feedback" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "message_feedback_extension_id_idx" ON "message_feedback" USING btree ("extension_id");--> statement-breakpoint
CREATE INDEX "message_feedback_rating_idx" ON "message_feedback" USING btree ("rating");--> statement-breakpoint
CREATE INDEX "message_feedback_given_by_user_id_idx" ON "message_feedback" USING btree ("given_by_user_id");--> statement-breakpoint
CREATE INDEX "message_reads_message_id_idx" ON "message_reads" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "message_reads_user_id_idx" ON "message_reads" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "message_reads_composite_idx" ON "message_reads" USING btree ("message_id","user_id");--> statement-breakpoint
CREATE INDEX "message_reads_message_user_unique" ON "message_reads" USING btree ("message_id","user_id");--> statement-breakpoint
CREATE INDEX "messages_conversation_id_idx" ON "messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "messages_created_at_idx" ON "messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "tenants_slug_idx" ON "tenants" USING btree ("slug");