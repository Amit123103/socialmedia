import "./env.js";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
export const dataDir = path.resolve(dir, "../data");
export const dbPath = process.env.DB_PATH || path.join(dataDir, "socialflow.sqlite");
fs.mkdirSync(dataDir, { recursive: true });
export const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

export function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL, email_verified INTEGER DEFAULT 0, timezone TEXT DEFAULT 'UTC', created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS refresh_tokens (id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL,token_hash TEXT NOT NULL,expires_at TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS password_resets (id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL,token_hash TEXT NOT NULL,expires_at TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS email_verifications (id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL,token_hash TEXT NOT NULL,expires_at TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS oauth_states (id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL,platform TEXT NOT NULL,state TEXT UNIQUE NOT NULL,code_verifier TEXT,expires_at TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS social_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL,platform TEXT NOT NULL,platform_account_id TEXT NOT NULL,
      display_name TEXT NOT NULL,avatar_url TEXT,status TEXT DEFAULT 'connected',access_token_enc TEXT,refresh_token_enc TEXT,
      expires_at TEXT,scopes TEXT,connected_at TEXT DEFAULT CURRENT_TIMESTAMP,UNIQUE(user_id,platform,platform_account_id),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS posts (id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL,title TEXT,content TEXT NOT NULL,hashtags TEXT,status TEXT DEFAULT 'draft',source TEXT DEFAULT 'manual',created_at TEXT DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS post_media (id INTEGER PRIMARY KEY AUTOINCREMENT,post_id INTEGER NOT NULL,url TEXT NOT NULL,type TEXT DEFAULT 'image',ai_generated INTEGER DEFAULT 0,prompt TEXT,FOREIGN KEY(post_id) REFERENCES posts(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS post_targets (id INTEGER PRIMARY KEY AUTOINCREMENT,post_id INTEGER NOT NULL,social_account_id INTEGER NOT NULL,platform_text_override TEXT,scheduled_at TEXT,published_at TEXT,status TEXT DEFAULT 'draft',external_post_id TEXT,external_url TEXT,error TEXT,FOREIGN KEY(post_id) REFERENCES posts(id) ON DELETE CASCADE,FOREIGN KEY(social_account_id) REFERENCES social_accounts(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS content_plans (id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL,niche TEXT,goal TEXT,audience TEXT,tone TEXT,start_date TEXT,platforms TEXT,status TEXT DEFAULT 'pending',FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS plan_items (id INTEGER PRIMARY KEY AUTOINCREMENT,plan_id INTEGER NOT NULL,post_id INTEGER,day_number INTEGER NOT NULL,theme TEXT,scheduled_at TEXT,status TEXT DEFAULT 'pending',FOREIGN KEY(plan_id) REFERENCES content_plans(id) ON DELETE CASCADE,FOREIGN KEY(post_id) REFERENCES posts(id) ON DELETE SET NULL);
    CREATE TABLE IF NOT EXISTS publish_jobs (id INTEGER PRIMARY KEY AUTOINCREMENT,post_target_id INTEGER NOT NULL,status TEXT DEFAULT 'queued',attempts INTEGER DEFAULT 0,next_run_at TEXT DEFAULT CURRENT_TIMESTAMP,error TEXT,locked_at TEXT,FOREIGN KEY(post_target_id) REFERENCES post_targets(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS activity_logs (id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL,type TEXT NOT NULL,description TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS notifications (id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL,title TEXT NOT NULL,message TEXT,read INTEGER DEFAULT 0,created_at TEXT DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE);
    CREATE INDEX IF NOT EXISTS idx_posts_user_status ON posts(user_id,status);
    CREATE INDEX IF NOT EXISTS idx_targets_scheduled ON post_targets(scheduled_at,status);
    CREATE INDEX IF NOT EXISTS idx_jobs_due ON publish_jobs(status,next_run_at);
  `);
  const oauthStateColumns = db.pragma("table_info(oauth_states)");
  if (!oauthStateColumns.some(column => column.name === "code_verifier")) {
    db.exec("ALTER TABLE oauth_states ADD COLUMN code_verifier TEXT");
  }
  const planColumns = db.pragma("table_info(content_plans)");
  if (!planColumns.some(column => column.name === "platforms")) {
    db.exec("ALTER TABLE content_plans ADD COLUMN platforms TEXT");
  }
}
migrate();
