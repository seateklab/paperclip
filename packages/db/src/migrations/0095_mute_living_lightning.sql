DROP INDEX "plugin_config_plugin_id_idx";--> statement-breakpoint
ALTER TABLE "plugin_config" ADD COLUMN "company_id" uuid;--> statement-breakpoint
ALTER TABLE "plugin_config" ADD CONSTRAINT "plugin_config_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "plugin_config_plugin_id_global_idx" ON "plugin_config" USING btree ("plugin_id") WHERE "plugin_config"."company_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "plugin_config_plugin_company_idx" ON "plugin_config" USING btree ("plugin_id","company_id") WHERE "plugin_config"."company_id" IS NOT NULL;