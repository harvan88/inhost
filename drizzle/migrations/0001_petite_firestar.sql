ALTER TABLE "conversations" ADD COLUMN "is_pinned" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "unread_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "last_read_at" timestamp;