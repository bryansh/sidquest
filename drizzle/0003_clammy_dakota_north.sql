ALTER TABLE "entity_types" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now();--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now();--> statement-breakpoint
ALTER TABLE "note_links" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now();