CREATE TABLE plugin_kie_image_cb149c1e4e.kie_image_generations (
  id text PRIMARY KEY,
  company_id text NOT NULL,
  issue_id text NOT NULL,
  agent_id text NOT NULL,
  run_id text NOT NULL,
  request_key text NOT NULL,
  model text NOT NULL,
  prompt text NOT NULL,
  purpose text,
  aspect_ratio text NOT NULL,
  resolution text,
  output_format text,
  status text NOT NULL,
  task_id text,
  result_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  estimated_cost_cents integer NOT NULL,
  credit_balance numeric,
  actual_cost_cents integer,
  preflight_comment_id text,
  submitted_at timestamptz,
  completed_at timestamptz,
  callback_received_at timestamptz,
  last_polled_at timestamptz,
  terminal_comment_sent_at timestamptz,
  wakeup_sent_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 0,
  failure_code text,
  failure_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT kie_image_generations_request_key_unique UNIQUE (company_id, request_key)
);

CREATE INDEX kie_image_generations_company_status_idx
  ON plugin_kie_image_cb149c1e4e.kie_image_generations (company_id, status);
CREATE INDEX kie_image_generations_company_issue_idx
  ON plugin_kie_image_cb149c1e4e.kie_image_generations (company_id, issue_id);
CREATE INDEX kie_image_generations_company_task_idx
  ON plugin_kie_image_cb149c1e4e.kie_image_generations (company_id, task_id);
