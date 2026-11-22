import "./env.js";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import multer from "multer";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cron from "node-cron";
import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import swaggerUi from "swagger-ui-express";
import { db } from "./db.js";
import { accessToken, refreshToken, encrypt, decrypt, randomToken, sha } from "./security.js";
import { createAuthorizationUrl, finishOAuth, oauthRedirectUri, socialPlatforms } from "./social-oauth.js";

const app = express();
const PORT = Number(process.env.PORT || 4000);
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173", credentials: true }));
app.use(express.json({ limit: "10mb" }));

const authLimiter = rateLimit({ windowMs: 15*60*1000, limit: 20, standardHeaders: "draft-8" });
app.use("/api/auth", authLimiter);

function log(userId, type, description) {
  db.prepare("INSERT INTO activity_logs(user_id,type,description) VALUES (?,?,?)").run(userId,type,description);
}
function auth(req,res,next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return res.status(401).json({error:"Unauthorized"});
  try {
    req.user = jwt.verify(header.slice(7), process.env.JWT_ACCESS_SECRET || "access-dev");
    next();
  } catch { res.status(401).json({error:"Session expired"}); }
}
function owned(table, id, userId) {
  const row = db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(id);
  return row?.user_id === userId ? row : null;
}
function noUserResource(res) { return res.status(404).json({error:"Resource not found"}); }

app.post("/api/auth/signup", async (req,res,next)=>{
  try {
    const s=z.object({name:z.string().min(2).max(80),email:z.string().email(),password:z.string().min(8),confirmPassword:z.string()}).refine(v=>v.password===v.confirmPassword,{message:"Passwords do not match",path:["confirmPassword"]});
    const v=s.parse(req.body);
    if (!/[A-Z]/.test(v.password)||!/\d/.test(v.password)) throw Object.assign(new Error("Password needs an uppercase letter and number"),{status:400});
    if (db.prepare("SELECT id FROM users WHERE email=?").get(v.email.toLowerCase())) throw Object.assign(new Error("Email already registered"),{status:409});
    const hash=await bcrypt.hash(v.password,12);
    const info=db.prepare("INSERT INTO users(name,email,password_hash,timezone) VALUES (?,?,?,?)").run(v.name,v.email.toLowerCase(),hash,"UTC");
    const user=db.prepare("SELECT * FROM users WHERE id=?").get(info.lastInsertRowid);
    const rt=randomToken(), rtf=refreshToken(user);
    db.prepare("INSERT INTO refresh_tokens(user_id,token_hash,expires_at) VALUES (?,?,?)").run(user.id,sha(rt),new Date(Date.now()+30*864e5).toISOString());
    log(user.id,"account","Account created");
    res.status(201).json({accessToken:accessToken(user),refreshToken:rtf+"."+rt,user:{id:user.id,name:user.name,email:user.email,timeZone:user.timezone,emailVerified:false}});
  } catch(e){ next(e); }
});
app.post("/api/auth/login",(req,res,next)=>{
  try {
    const v=z.object({email:z.string().email(),password:z.string()}).parse(req.body);
    const user=db.prepare("SELECT * FROM users WHERE email=?").get(v.email.toLowerCase());
    if (!user||!bcrypt.compareSync(v.password,user.password_hash)) throw Object.assign(new Error("Invalid email or password"),{status:401});
    const rt=randomToken(), rtf=refreshToken(user);
    db.prepare("INSERT INTO refresh_tokens(user_id,token_hash,expires_at) VALUES (?,?,?)").run(user.id,sha(rt),new Date(Date.now()+30*864e5).toISOString());
    res.json({accessToken:accessToken(user),refreshToken:rtf+"."+rt,user:{id:user.id,name:user.name,email:user.email,timeZone:user.timezone,emailVerified:Boolean(user.email_verified)}});
  } catch(e){next(e);}
});
app.post("/api/auth/refresh",(req,res,next)=>{
  try {
    const v=z.object({refreshToken:z.string().min(32)}).parse(req.body);
    const separator=v.refreshToken.lastIndexOf(".");
    if(separator<0) throw Object.assign(new Error("Invalid refresh token"),{status:401});
    const jwtPart=v.refreshToken.slice(0,separator);
    const rawPart=v.refreshToken.slice(separator+1);
    if (!jwtPart||!rawPart) throw Object.assign(new Error("Invalid refresh token"),{status:401});
    const payload=jwt.verify(jwtPart,process.env.JWT_REFRESH_SECRET||"refresh-dev");
    if(payload.type!=="refresh") throw Object.assign(new Error("Invalid refresh token"),{status:401});
    const row=db.prepare("SELECT * FROM refresh_tokens WHERE user_id=? AND token_hash=?").get(payload.sub,sha(rawPart));
    if(!row||new Date(row.expires_at)<=new Date()) throw Object.assign(new Error("Refresh token expired"),{status:401});
    const user=db.prepare("SELECT * FROM users WHERE id=?").get(payload.sub);
    res.json({accessToken:accessToken(user)});
  }catch(e){next(e.status?e:Object.assign(new Error("Invalid refresh token"),{status:401}));}
});
app.post("/api/auth/forgot",(req,res)=>{
  const v=z.object({email:z.string().email()}).safeParse(req.body);
  if (v.success) {
    const user=db.prepare("SELECT * FROM users WHERE email=?").get(v.data.email.toLowerCase());
    if (user) { const token=randomToken(); db.prepare("INSERT INTO password_resets(user_id,token_hash,expires_at) VALUES (?,?,?)").run(user.id,sha(token),new Date(Date.now()+3600e3).toISOString()); if (process.env.NODE_ENV!=="production") console.log(`[DEV] Password reset link: ${process.env.CLIENT_URL||"http://localhost:5173"}/reset-password?token=${token}`); }
  }
  res.json({message:"If the account exists, reset instructions were sent."});
});
app.post("/api/auth/reset",(req,res,next)=>{
  try {
    const v=z.object({token:z.string().min(32),password:z.string().min(8)}).parse(req.body);
    const row=db.prepare("SELECT * FROM password_resets WHERE token_hash=?").get(sha(v.token));
    if (!row||new Date(row.expires_at)<=new Date()) throw Object.assign(new Error("Reset token invalid or expired"),{status:400});
    db.prepare("UPDATE users SET password_hash=? WHERE id=?").run(bcrypt.hashSync(v.password,12),row.user_id);
    db.prepare("DELETE FROM password_resets WHERE id=?").run(row.id);
    res.json({message:"Password reset successfully"});
  }catch(e){next(e);}
});
app.post("/api/auth/logout",auth,(req,res)=>{
  db.prepare("DELETE FROM refresh_tokens WHERE user_id=?").run(req.user.sub);
  res.json({message:"Logged out"});
});
app.get("/api/auth/me",auth,(req,res)=>{
  const user=db.prepare("SELECT id,name,email,email_verified,timezone FROM users WHERE id=?").get(req.user.sub);
  if (!user) return res.status(401).json({error:"Unauthorized"});
  res.json({id:user.id,name:user.name,email:user.email,emailVerified:Boolean(user.email_verified),timeZone:user.timezone});
});
app.post("/api/auth/email/verify-request",auth,(req,res)=>{
  const user=db.prepare("SELECT * FROM users WHERE id=?").get(req.user.sub);
  const token=randomToken();
  db.prepare("INSERT INTO email_verifications(user_id,token_hash,expires_at) VALUES (?,?,?)").run(user.id,sha(token),new Date(Date.now()+24*3600e3).toISOString());
  if(process.env.NODE_ENV!=="production") console.log(`[DEV] Email verification link: ${process.env.CLIENT_URL||"http://localhost:5173"}/verify-email?token=${token}`);
  res.json({message:"Verification email sent"});
});
app.post("/api/auth/email/verify",(req,res,next)=>{
  try {
    const v=z.object({token:z.string().min(32)}).parse(req.body);
    const row=db.prepare("SELECT * FROM email_verifications WHERE token_hash=?").get(sha(v.token));
    if(!row||new Date(row.expires_at)<=new Date()) throw Object.assign(new Error("Verification token invalid or expired"),{status:400});
    db.prepare("UPDATE users SET email_verified=1 WHERE id=?").run(row.user_id);
    db.prepare("DELETE FROM email_verifications WHERE id=?").run(row.id);
    res.json({message:"Email verified"});
  }catch(e){next(e);}
});
app.patch("/api/users/me",auth,(req,res,next)=>{
  try {
    const v=z.object({name:z.string().min(2).optional(),timezone:z.string().optional(),password:z.string().min(8).optional()}).parse(req.body);
    const user=db.prepare("SELECT * FROM users WHERE id=?").get(req.user.sub);
    db.prepare("UPDATE users SET name=?,timezone=?,password_hash=? WHERE id=?").run(v.name||user.name,v.timezone||user.timezone,v.password?bcrypt.hashSync(v.password,12):user.password_hash,user.id);
    log(user.id,"settings","Profile updated");
    res.json({id:user.id,name:v.name||user.name,email:user.email,timeZone:v.timezone||user.timezone});
  }catch(e){next(e);}
});
app.delete("/api/users/me",auth,(req,res)=>{
  db.prepare("DELETE FROM users WHERE id=?").run(req.user.sub);
  res.status(204).end();
});

const platforms=["facebook","instagram","x","linkedin","youtube","tiktok","pinterest","threads","telegram","reddit"];
app.get("/api/social/platforms",(req,res)=>res.json(socialPlatforms()));
app.post("/api/social/connect/:platform",auth,(req,res,next)=>{
  try {
    const platform=req.params.platform;
    if (!platforms.includes(platform)) return res.status(400).json({error:"Unsupported platform"});
    const state=randomToken();
    const verifier=randomToken();
    const redirectUri=oauthRedirectUri(platform);
    const authUrl=createAuthorizationUrl(platform,state,verifier,redirectUri);
    db.prepare("DELETE FROM oauth_states WHERE expires_at<=?").run(new Date().toISOString());
    db.prepare("INSERT INTO oauth_states(user_id,platform,state,code_verifier,expires_at) VALUES (?,?,?,?,?)").run(req.user.sub,platform,state,verifier,new Date(Date.now()+10*60e3).toISOString());
    res.json({authUrl});
  } catch(e) { next(e); }
});
app.get("/api/social/callback/:platform",async(req,res)=>{
  const platform=req.params.platform;
  const clientUrl=new URL(process.env.CLIENT_URL||"http://localhost:5173");
  const finish=(status,message)=>{
    const destination=new URL("/",clientUrl);
    destination.searchParams.set("social",status);
    destination.searchParams.set("platform",platform);
    if(message) destination.searchParams.set("message",message);
    res.redirect(302,destination.toString());
  };
  try {
    const state=String(req.query.state||"");
    const oauth=db.prepare("SELECT * FROM oauth_states WHERE state=? AND platform=?").get(state,platform);
    if(!oauth||new Date(oauth.expires_at)<=new Date()) throw new Error("This connection link has expired. Please try again.");
    db.prepare("DELETE FROM oauth_states WHERE id=?").run(oauth.id);
    if(req.query.error) throw new Error("The social platform declined the connection request.");
    const code=String(req.query.code||"");
    if(!code) throw new Error("The social platform did not return an authorization code.");
    const account=await finishOAuth(platform,code,oauthRedirectUri(platform),oauth.code_verifier);
    db.prepare(`INSERT INTO social_accounts(user_id,platform,platform_account_id,display_name,avatar_url,status,access_token_enc,refresh_token_enc,expires_at,scopes)
      VALUES (?,?,?,?,?,'connected',?,?,?,?)
      ON CONFLICT(user_id,platform,platform_account_id) DO UPDATE SET
      display_name=excluded.display_name,avatar_url=excluded.avatar_url,status='connected',
      access_token_enc=excluded.access_token_enc,
      refresh_token_enc=COALESCE(excluded.refresh_token_enc,social_accounts.refresh_token_enc),
      expires_at=excluded.expires_at,scopes=excluded.scopes,connected_at=CURRENT_TIMESTAMP`)
      .run(oauth.user_id,platform,account.id,account.displayName,account.avatarUrl,encrypt(account.accessToken),account.refreshToken?encrypt(account.refreshToken):null,account.expiresAt,account.scope);
    log(oauth.user_id,"connection",`${platform} account connected`);
    finish("connected",`${platform} account connected.`);
  } catch(e) {
    console.error(`[social OAuth] ${platform}: ${e.message}`);
    finish("error","Could not connect this account. Check the provider app setup and permissions, then try again.");
  }
});
app.get("/api/social/accounts",auth,(req,res)=>res.json(db.prepare("SELECT id,platform,platform_account_id,display_name,avatar_url,status,expires_at,scopes,connected_at FROM social_accounts WHERE user_id=? AND status='connected'").all(req.user.sub)));
app.delete("/api/social/:id",auth,(req,res)=>{
  const account=db.prepare("SELECT * FROM social_accounts WHERE id=? AND user_id=?").get(req.params.id,req.user.sub);
  if (!account) return noUserResource(res);
  db.prepare("UPDATE social_accounts SET status='disconnected',access_token_enc=NULL,refresh_token_enc=NULL,expires_at=NULL WHERE id=?").run(account.id);
  log(req.user.sub,"connection",`${account.platform} account disconnected`);
  res.status(204).end();
});

async function publishTarget(target) {
  const account=db.prepare("SELECT * FROM social_accounts WHERE id=?").get(target.social_account_id);
  if (!account) throw new Error("Connected account no longer exists");
  if (account.status!=="connected") throw new Error("Social account is not connected; reconnect it before publishing.");
  if (account.expires_at && new Date(account.expires_at)<=new Date()) throw new Error("Social token expired; reconnect account.");
  throw Object.assign(new Error(`Live publishing is not implemented for ${account.platform}. The post was not sent.`),{status:501});
}

app.post("/api/posts",auth,(req,res,next)=>{
  try {
    const v=z.object({title:z.string().optional(),content:z.string().min(1),hashtags:z.union([z.string(),z.array(z.string())]).optional(),source:z.enum(["manual","ai","plan"]).default("manual"),status:z.enum(["draft","scheduled","published","failed"]).default("draft"),accountIds:z.array(z.number()).optional(),scheduledAt:z.string().nullable().optional(),media:z.array(z.object({url:z.string(),type:z.string().default("image"),aiGenerated:z.boolean().optional(),prompt:z.string().optional()})).optional()}).parse(req.body);
    const hashtags=Array.isArray(v.hashtags)?v.hashtags.join(" "):v.hashtags||"";
    const accountIds=[...new Set(v.accountIds||[])];
    if((v.status==="scheduled"||v.status==="published")&&!accountIds.length) throw Object.assign(new Error("Select at least one connected account."),{status:400});
    if(v.status==="scheduled"&&(!v.scheduledAt||!Number.isFinite(Date.parse(v.scheduledAt))||Date.parse(v.scheduledAt)<=Date.now())) throw Object.assign(new Error("Choose a valid future date and time."),{status:400});
    const accountQuery=accountIds.length?db.prepare(`SELECT id FROM social_accounts WHERE user_id=? AND id IN (${accountIds.map(()=>"?").join(",")})`):null;
    const accounts=accountQuery?accountQuery.all(req.user.sub,...accountIds):[];
    if(accounts.length!==accountIds.length) throw Object.assign(new Error("One or more selected accounts are unavailable."),{status:400});
    const scheduledAt=v.scheduledAt?new Date(v.scheduledAt).toISOString():null;
    const savedStatus=v.status==="published"?"draft":v.status;
    const insertPost=db.prepare("INSERT INTO posts(user_id,title,content,hashtags,status,source) VALUES (?,?,?,?,?,?)");
    const insertMedia=db.prepare("INSERT INTO post_media(post_id,url,type,ai_generated,prompt) VALUES (?,?,?,?,?)");
    const insertTarget=db.prepare("INSERT INTO post_targets(post_id,social_account_id,scheduled_at,status) VALUES (?,?,?,?)");
    const insertJob=db.prepare("INSERT INTO publish_jobs(post_target_id,status,next_run_at) VALUES (?,'queued',?)");
    const createPost=db.transaction(()=>{
      const result=insertPost.run(req.user.sub,v.title||null,v.content,hashtags,savedStatus,v.source);
      const postId=Number(result.lastInsertRowid);
      for(const m of v.media||[]) insertMedia.run(postId,m.url,m.type,m.aiGenerated?1:0,m.prompt||null);
      for(const account of accounts) {
        const targetStatus=v.status==="scheduled"?"scheduled":"draft";
        const target=insertTarget.run(postId,account.id,v.status==="scheduled"?scheduledAt:null,targetStatus);
        if(v.status==="scheduled") insertJob.run(target.lastInsertRowid,scheduledAt);
      }
      return postId;
    });
    const postId=createPost();
    log(req.user.sub,"post",v.status==="scheduled"?"Post scheduled":"Post created");
    res.status(201).json(db.prepare("SELECT * FROM posts WHERE id=?").get(postId));
  }catch(e){next(e);}
});
app.get("/api/posts",auth,(req,res)=>{
  const {status,platform}=req.query;
  let rows=db.prepare("SELECT * FROM posts WHERE user_id=? ORDER BY created_at DESC").all(req.user.sub);
  if(status&&status!=="all") rows=rows.filter(p=>p.status===status);
  if(platform&&platform!=="all") rows=rows.filter(p=>db.prepare("SELECT 1 FROM post_targets pt JOIN social_accounts sa ON sa.id=pt.social_account_id WHERE pt.post_id=? AND sa.platform=?").get(p.id,platform));
  res.json(rows.map(p=>({...p,targets:db.prepare(`SELECT pt.*,sa.platform,sa.display_name FROM post_targets pt JOIN social_accounts sa ON sa.id=pt.social_account_id WHERE pt.post_id=?`).all(p.id),media:db.prepare("SELECT * FROM post_media WHERE post_id=?").all(p.id)})));
});
app.get("/api/posts/:id",auth,(req,res)=>{
  const p=db.prepare("SELECT * FROM posts WHERE id=? AND user_id=?").get(req.params.id,req.user.sub); if(!p)return noUserResource(res);
  res.json({...p,targets:db.prepare(`SELECT pt.*,sa.platform,sa.display_name FROM post_targets pt JOIN social_accounts sa ON sa.id=pt.social_account_id WHERE pt.post_id=?`).all(p.id),media:db.prepare("SELECT * FROM post_media WHERE post_id=?").all(p.id)});
});
app.patch("/api/posts/:id",auth,(req,res,next)=>{
  try {
    const p=db.prepare("SELECT * FROM posts WHERE id=? AND user_id=?").get(req.params.id,req.user.sub);if(!p)return noUserResource(res);
    const v=z.object({title:z.string().optional(),content:z.string().optional(),hashtags:z.string().optional(),status:z.string().optional()}).parse(req.body);
    db.prepare("UPDATE posts SET title=?,content=?,hashtags=?,status=? WHERE id=?").run(v.title??p.title,v.content??p.content,v.hashtags??p.hashtags,v.status??p.status,p.id);
    res.json(db.prepare("SELECT * FROM posts WHERE id=?").get(p.id));
  }catch(e){next(e);}
});
app.delete("/api/posts/:id",auth,(req,res)=>{
  const p=db.prepare("SELECT * FROM posts WHERE id=? AND user_id=?").get(req.params.id,req.user.sub);if(!p)return noUserResource(res);
  db.prepare("DELETE FROM posts WHERE id=?").run(p.id);res.status(204).end();
});
app.post("/api/posts/:id/publish",auth,async(req,res,next)=>{
  try {
    const p=db.prepare("SELECT * FROM posts WHERE id=? AND user_id=?").get(req.params.id,req.user.sub);if(!p)return noUserResource(res);
    const targets=db.prepare("SELECT * FROM post_targets WHERE post_id=?").all(p.id);
    if(!targets.length) throw Object.assign(new Error("Select at least one connected account"),{status:400});
    const results=[];
    for(const t of targets){try{results.push(await publishTarget(t));}catch(e){db.prepare("UPDATE post_targets SET status='failed',error=? WHERE id=?").run(e.message,t.id);results.push({socialAccountId:t.social_account_id,status:"failed",error:e.message});}}
    db.prepare("UPDATE posts SET status=? WHERE id=?").run(results.every(r=>r.status==="published")?"published":"failed",p.id);
    const published=results.filter(r=>r.status==="published").length;
    log(req.user.sub,"publish",`Published ${published} of ${results.length} targets`);
    res.json({results});
  }catch(e){next(e);}
});

const uploadDir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../uploads");fs.mkdirSync(uploadDir,{recursive:true});
const upload=multer({dest:uploadDir,limits:{fileSize:100*1024*1024}});
app.use("/uploads",express.static(uploadDir));
app.post("/api/media/upload",auth,upload.array("files",10),(req,res)=>res.json((req.files||[]).map(f=>({url:`/uploads/${f.filename}`,type:f.mimetype.startsWith("video")?"video":"image"}))));

async function askAnthropic(prompt,maxTokens=1600) {
  const apiKey=process.env.ANTHROPIC_API_KEY;
  const model=process.env.ANTHROPIC_MODEL||"claude-sonnet-4-20250514";
  if(!apiKey) throw Object.assign(new Error("AI is not configured. Set ANTHROPIC_API_KEY on the server."),{status:503});
  const response=await fetch("https://api.anthropic.com/v1/messages",{
    method:"POST",
    headers:{"Content-Type":"application/json","x-api-key":apiKey,"anthropic-version":"2023-06-01"},
    body:JSON.stringify({model,max_tokens:maxTokens,messages:[{role:"user",content:prompt}]}),
    signal:AbortSignal.timeout(30000)
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok) throw Object.assign(new Error(data.error?.message||`AI provider request failed (${response.status}).`),{status:502});
  const text=(data.content||[]).filter(item=>item.type==="text").map(item=>item.text).join("\n");
  if(!text) throw Object.assign(new Error("AI provider returned an empty response."),{status:502});
  return text;
}
function parseAIJson(text) {
  const start=text.indexOf("{"),end=text.lastIndexOf("}");
  if(start<0||end<=start) throw Object.assign(new Error("AI provider returned an invalid response format."),{status:502});
  try{return JSON.parse(text.slice(start,end+1))}catch{throw Object.assign(new Error("AI provider returned invalid JSON."),{status:502})}
}

app.post("/api/ai/text",auth,async(req,res,next)=>{
  try {
    const v=z.object({topic:z.string().trim().min(1).max(2000),brand:z.string().max(120).optional(),tone:z.string().min(1).max(80).default("professional"),platforms:z.array(z.string().min(1).max(40)).min(1).max(10),language:z.string().max(80).default("English"),keywords:z.string().max(500).optional()}).parse(req.body);
    const prompt=`Create one original social post for each requested platform. Return only valid JSON with this shape: {"posts":[{"platform":"exact platform id","caption":"post text","hashtags":["#tag"]}]}. Do not add markdown or prose. Keep each caption native to its platform and within its usual length. Language: ${v.language}. Tone: ${v.tone}. Brand: ${v.brand||"not specified"}. Keywords: ${v.keywords||"none"}. Topic: ${v.topic}. Platforms: ${v.platforms.join(", ")}.`;
    const output=z.object({posts:z.array(z.object({platform:z.string(),caption:z.string().min(1),hashtags:z.array(z.string()).default([])}))}).parse(parseAIJson(await askAnthropic(prompt)));
    const posts=v.platforms.map(platform=>{
      const post=output.posts.find(item=>item.platform===platform);
      if(!post) throw Object.assign(new Error(`AI provider did not return a post for ${platform}.`),{status:502});
      return post;
    });
    res.json(posts);
  }catch(e){next(e)}
});

app.post("/api/plans/generate",auth,async(req,res,next)=>{
  try {
    const v=z.object({niche:z.string().trim().min(1).max(120),goal:z.string().trim().min(1).max(240),audience:z.string().trim().min(1).max(240),tone:z.string().trim().min(1).max(80),platforms:z.array(z.string()).min(1).max(10),startDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/)}).parse(req.body);
    if(v.platforms.some(platform=>!platforms.includes(platform))||new Set(v.platforms).size!==v.platforms.length) throw Object.assign(new Error("Choose unique supported platforms."),{status:400});
    const firstScheduledAt=new Date(`${v.startDate}T10:00:00Z`);
    if(!Number.isFinite(firstScheduledAt.getTime())||firstScheduledAt.toISOString().slice(0,10)!==v.startDate||firstScheduledAt<=new Date()) throw Object.assign(new Error("Choose a valid future start date."),{status:400});
    const connectedPlatforms=new Set(db.prepare("SELECT DISTINCT platform FROM social_accounts WHERE user_id=? AND status='connected'").all(req.user.sub).map(account=>account.platform));
    if(v.platforms.some(platform=>!connectedPlatforms.has(platform))) throw Object.assign(new Error("Connect accounts for each selected platform before generating a plan."),{status:400});
    const generated=z.object({items:z.array(z.object({theme:z.string().min(1),caption:z.string().min(1),hashtags:z.array(z.string()).default([])})).length(7)}).parse(parseAIJson(await askAnthropic(`Create a realistic seven-day social content plan. Return only valid JSON: {"items":[{"theme":"short theme","caption":"complete post copy","hashtags":["#tag"]}]} with exactly seven items. Niche: ${v.niche}. Goal: ${v.goal}. Audience: ${v.audience}. Tone: ${v.tone}. Platforms: ${v.platforms.join(", ")}. Do not schedule or claim anything has been published.`)));
    const createPlan=db.transaction(()=>{
      const planInfo=db.prepare("INSERT INTO content_plans(user_id,niche,goal,audience,tone,start_date,platforms,status) VALUES (?,?,?,?,?,?,?,?)").run(req.user.sub,v.niche,v.goal,v.audience,v.tone,v.startDate,JSON.stringify(v.platforms),"pending");
      const planId=Number(planInfo.lastInsertRowid);
      const items=generated.items.map((item,index)=>{
        const date=new Date(`${v.startDate}T10:00:00Z`);date.setUTCDate(date.getUTCDate()+index);
        const post=db.prepare("INSERT INTO posts(user_id,title,content,hashtags,status,source) VALUES (?,?,?,?,?,?)").run(req.user.sub,item.theme,item.caption,item.hashtags.join(" "),"draft","plan");
        const postId=Number(post.lastInsertRowid);
        db.prepare("INSERT INTO plan_items(plan_id,post_id,day_number,theme,scheduled_at,status) VALUES (?,?,?,?,?,?)").run(planId,postId,index+1,item.theme,date.toISOString(),"pending");
        return {day:index+1,date:date.toISOString().slice(0,10),theme:item.theme,caption:item.caption,hashtags:item.hashtags,platforms:v.platforms,scheduledAt:date.toISOString(),postId,status:"pending"};
      });
      return {id:planId,status:"pending",items};
    });
    const plan=createPlan();
    log(req.user.sub,"plan","Generated a 7-day content plan");
    res.status(201).json(plan);
  }catch(e){next(e)}
});
app.get("/api/plans",auth,(req,res)=>res.json(db.prepare("SELECT * FROM content_plans WHERE user_id=? ORDER BY id DESC").all(req.user.sub)));
app.post("/api/plans/:id/approve",auth,(req,res)=>{
  const plan=db.prepare("SELECT * FROM content_plans WHERE id=? AND user_id=?").get(req.params.id,req.user.sub);if(!plan)return noUserResource(res);
  if(plan.status!=="pending")return res.status(409).json({error:"This plan has already been processed."});
  const platforms=JSON.parse(plan.platforms||"[]");
  if(!platforms.length)return res.status(400).json({error:"Choose at least one platform for this plan."});
  const accounts=db.prepare(`SELECT id FROM social_accounts WHERE user_id=? AND status='connected' AND platform IN (${platforms.map(()=>"?").join(",")})`).all(req.user.sub,...platforms);
  if(!accounts.length)return res.status(400).json({error:"Connect an account for one of this plan’s selected platforms first."});
  const items=db.prepare("SELECT * FROM plan_items WHERE plan_id=?").all(plan.id);
  if(!items.length||items.some(item=>!item.post_id))return res.status(409).json({error:"This plan has no saved posts to schedule."});
  const schedulePlan=db.transaction(()=>{
    let count=0;
    for(const item of items){
      if(new Date(item.scheduled_at)<=new Date())throw Object.assign(new Error("One or more plan dates have passed. Generate a new plan before scheduling."),{status:400});
      for(const account of accounts){const tr=db.prepare("INSERT INTO post_targets(post_id,social_account_id,scheduled_at,status) VALUES (?,?,?,?)").run(item.post_id,account.id,item.scheduled_at,"scheduled");db.prepare("INSERT INTO publish_jobs(post_target_id,status,next_run_at) VALUES (?,'queued',?)").run(tr.lastInsertRowid,item.scheduled_at);count++;}
      db.prepare("UPDATE plan_items SET status='scheduled' WHERE id=?").run(item.id);
      db.prepare("UPDATE posts SET status='scheduled' WHERE id=?").run(item.post_id);
    }
    db.prepare("UPDATE content_plans SET status='active' WHERE id=?").run(plan.id);
    return count;
  });
  let count;
  try{count=schedulePlan()}catch(e){if(e.status)return res.status(e.status).json({error:e.message});throw e}
  log(req.user.sub,"plan","Approved and scheduled 7-day content plan");
  res.json({status:"active",scheduledTargets:count});
});
app.post("/api/plans/:id/:action",auth,(req,res)=>{
  if(!["pause","resume","cancel"].includes(req.params.action))return res.status(400).json({error:"Invalid action"});
  const status=req.params.action==="pause"?"paused":req.params.action==="cancel"?"cancelled":"active";
  const plan=db.prepare("SELECT * FROM content_plans WHERE id=? AND user_id=?").get(req.params.id,req.user.sub);if(!plan)return noUserResource(res);
  db.prepare("UPDATE content_plans SET status=? WHERE id=?").run(status,plan.id);
  res.json({status});
});

app.get("/api/calendar",auth,(req,res)=>{
  const from=req.query.from||"1970-01-01",to=req.query.to||"2100-01-01";
  const posts=db.prepare(`SELECT pt.*,p.content,p.source,sa.platform,sa.display_name FROM post_targets pt JOIN posts p ON p.id=pt.post_id JOIN social_accounts sa ON sa.id=pt.social_account_id WHERE p.user_id=? AND pt.scheduled_at>=? AND pt.scheduled_at<=?`).all(req.user.sub,from,to);
  res.json(posts);
});
app.get("/api/analytics",auth,(req,res)=>{
  const published=db.prepare("SELECT COUNT(*) n FROM post_targets pt JOIN posts p ON p.id=pt.post_id WHERE p.user_id=? AND pt.status='published'").get(req.user.sub).n;
  const scheduled=db.prepare("SELECT COUNT(*) n FROM post_targets pt JOIN posts p ON p.id=pt.post_id WHERE p.user_id=? AND pt.status='scheduled'").get(req.user.sub).n;
  const failed=db.prepare("SELECT COUNT(*) n FROM post_targets pt JOIN posts p ON p.id=pt.post_id WHERE p.user_id=? AND pt.status='failed'").get(req.user.sub).n;
  const connected=db.prepare("SELECT COUNT(*) n FROM social_accounts WHERE user_id=? AND status='connected'").get(req.user.sub).n;
  const activity=db.prepare("SELECT * FROM activity_logs WHERE user_id=? ORDER BY id DESC LIMIT 8").all(req.user.sub);
  const start=new Date();start.setUTCHours(0,0,0,0);start.setUTCDate(start.getUTCDate()-6);
  const counts=db.prepare("SELECT substr(pt.published_at,1,10) AS date,COUNT(*) AS value FROM post_targets pt JOIN posts p ON p.id=pt.post_id WHERE p.user_id=? AND pt.status='published' AND pt.published_at>=? GROUP BY substr(pt.published_at,1,10)").all(req.user.sub,start.toISOString());
  const countByDate=new Map(counts.map(row=>[row.date,row.value]));
  const chart=Array.from({length:7},(_,index)=>{
    const date=new Date(start);date.setUTCDate(start.getUTCDate()+index);
    const key=date.toISOString().slice(0,10);
    return {day:date.toLocaleDateString("en-US",{weekday:"short",timeZone:"UTC"}),value:countByDate.get(key)||0};
  });
  res.json({connected,scheduled,published,failed,activity,chart,updatedAt:new Date().toISOString()});
});
app.get("/api/notifications",auth,(req,res)=>res.json(db.prepare("SELECT * FROM notifications WHERE user_id=? ORDER BY id DESC").all(req.user.sub)));
app.patch("/api/notifications/:id/read",auth,(req,res)=>{
  db.prepare("UPDATE notifications SET read=1 WHERE id=? AND user_id=?").run(req.params.id,req.user.sub);res.json({ok:true});
});

const openapi={openapi:"3.0.0",info:{title:"SocialFlow API",version:"1.0.0"},paths:{"/api/auth/signup":{"post":{"summary":"Create account","responses":{"201":{"description":"Created"}}}},"/api/posts":{"get":{"summary":"List posts"},"post":{"summary":"Create post"}},"/api/plans/generate":{"post":{"summary":"Generate 7-day plan"}}}};
app.use("/api/docs",swaggerUi.serve,swaggerUi.setup(openapi));

app.get("/api/health",(req,res)=>res.json({ok:true,storage:"sqlite"}));
const frontendDir=path.resolve(process.cwd(),"../frontend/dist");
if(fs.existsSync(frontendDir)){
  app.use(express.static(frontendDir));
  app.get("/{*path}",(req,res,next)=>{
    if(req.path.startsWith("/api")||req.path.startsWith("/uploads")) return next();
    res.sendFile(path.join(frontendDir,"index.html"));
  });
}
app.use((err,req,res,next)=>{
  if (err instanceof z.ZodError) return res.status(400).json({error:"Validation failed",details:err.issues});
  console.error(`[${new Date().toISOString()}]`,err.message);
  res.status(err.status||500).json({error:err.message||"Internal server error"});
});

cron.schedule("* * * * *",()=>{
  const now=new Date().toISOString();
  const jobs=db.prepare("SELECT * FROM publish_jobs WHERE status='queued' AND next_run_at<=? LIMIT 20").all(now);
  for(const job of jobs){
    const lock=db.prepare("UPDATE publish_jobs SET status='processing',locked_at=? WHERE id=? AND status='queued'").run(now,job.id);
    if(lock.changes!==1) continue;
    try{
      const target=db.prepare("SELECT pt.*,p.user_id,p.id AS post_id FROM post_targets pt JOIN posts p ON p.id=pt.post_id WHERE pt.id=?").get(job.post_target_id);
      publishTarget(target).then(()=>{
        db.prepare("UPDATE publish_jobs SET status='completed' WHERE id=?").run(job.id);
        db.prepare("UPDATE posts SET status='published' WHERE id=? AND NOT EXISTS (SELECT 1 FROM post_targets WHERE post_id=? AND status!='published')").run(target.post_id,target.post_id);
      }).catch(e=>{
        const attempts=job.attempts+1, terminal=attempts>=3||e.status===501||e.status===401, delay=Math.pow(2,attempts)*60*1000;
        db.prepare("UPDATE publish_jobs SET status=?,attempts=?,next_run_at=?,error=? WHERE id=?").run(terminal?"failed":"queued",attempts,new Date(Date.now()+delay).toISOString(),e.message,job.id);
        db.prepare("UPDATE post_targets SET status=?,error=? WHERE id=?").run(terminal?"failed":"scheduled",e.message,target.id);
        if(terminal){
          db.prepare("UPDATE posts SET status='failed' WHERE id=?").run(target.post_id);
          db.prepare("INSERT INTO notifications(user_id,title,message) VALUES (?,?,?)").run(target.user_id,"Publishing failed",`Post target ${target.id} was not published: ${e.message}`);
        }
      });
    }catch(e){console.error("Scheduler error",e);}
  }
});

app.listen(PORT,()=>console.log(`SocialFlow API listening on http://localhost:${PORT}`));
