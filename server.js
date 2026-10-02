const express=require("express");
const path=require("path"), bcrypt=require("bcryptjs"), jwt=require("jsonwebtoken");
const {Pool}=require("pg"), helmet=require("helmet"), cors=require("cors"), rateLimit=require("express-rate-limit");
require("dotenv").config();

const app=express();
const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.DATABASE_URL?.includes("sslmode=require")?{rejectUnauthorized:false}:undefined});
app.use(helmet({contentSecurityPolicy:false}));
app.use(cors({origin:true,credentials:true}));
app.use(express.json({limit:"1mb"}));
app.use(rateLimit({windowMs:15*60*1000,max:300}));
app.use(express.static(path.join(__dirname,"public")));

async function db(q,p=[]){return (await pool.query(q,p)).rows}
async function init(){
 await db(`CREATE TABLE IF NOT EXISTS users(id SERIAL PRIMARY KEY,name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,phone TEXT,role TEXT NOT NULL DEFAULT 'client',password_hash TEXT NOT NULL,created_at TIMESTAMPTZ DEFAULT now())`);
 await db(`CREATE TABLE IF NOT EXISTS orders(id SERIAL PRIMARY KEY,client_id INT REFERENCES users(id),category TEXT NOT NULL,description TEXT,area NUMERIC,budget NUMERIC,place TEXT,work_date DATE,status TEXT DEFAULT 'active',created_at TIMESTAMPTZ DEFAULT now())`);
 await db(`CREATE TABLE IF NOT EXISTS offers(id SERIAL PRIMARY KEY,order_id INT REFERENCES orders(id) ON DELETE CASCADE,worker_id INT REFERENCES users(id),price NUMERIC NOT NULL,note TEXT,rating NUMERIC DEFAULT 5,created_at TIMESTAMPTZ DEFAULT now())`);
 await db(`CREATE TABLE IF NOT EXISTS messages(id SERIAL PRIMARY KEY,order_id INT REFERENCES orders(id) ON DELETE CASCADE,sender_id INT REFERENCES users(id),body TEXT NOT NULL,created_at TIMESTAMPTZ DEFAULT now())`);
 const e=process.env.ADMIN_EMAIL,p=process.env.ADMIN_PASSWORD;
 if(!exists.length)await db("INSERT INTO users(name,email,role,password_hash) VALUES($1,$2,'admin',$3)",["Ahims1997",e,await bcrypt.hash(p,12)]);else await db("UPDATE users SET name=$1 WHERE email=$2",["Ahims1997",e]);
}
function token(u){return jwt.sign({id:u.id,role:u.role,email:u.email},process.env.JWT_SECRET,{expiresIn:"7d"})}
function auth(req,res,next){try{const h=req.headers.authorization||"";req.user=jwt.verify(h.replace("Bearer ",""),process.env.JWT_SECRET);next()}catch(e){res.status(401).json({error:"Nepieciešama autorizācija"})}}
function admin(req,res,next){if(req.user?.role!=="admin")return res.status(403).json({error:"Tikai administratoram"});next()}

app.get("/api/health",(req,res)=>res.json({ok:true,service:"Meistars.lv"}));
app.post("/api/auth/register",async(req,res)=>{try{const {name,email,password,phone,role="client"}=req.body;if(!name||!email||!password)return res.status(400).json({error:"Aizpildi vārdu, e-pastu un paroli"});if(!["client","worker"].includes(role))return res.status(400).json({error:"Nepareiza loma"});const hash=await bcrypt.hash(password,12);const rows=await db("INSERT INTO users(name,email,phone,role,password_hash) VALUES($1,$2,$3,$4,$5) RETURNING id,name,email,phone,role",[name,email.toLowerCase(),phone||"",role,hash]);res.json({user:rows[0],token:token(rows[0])})}catch(e){res.status(400).json({error:e.code==="23505"?"Šāds e-pasts jau ir reģistrēts":"Reģistrācija neizdevās"})}});
app.post("/api/auth/login",async(req,res)=>{const {email,password}=req.body;const u=(await db("SELECT * FROM users WHERE email=$1",[String(email||"").toLowerCase()]))[0];if(!u||!(await bcrypt.compare(password||"",u.password_hash)))return res.status(401).json({error:"Nepareizs e-pasts vai parole"});res.json({user:{id:u.id,name:u.name,email:u.email,phone:u.phone,role:u.role},token:token(u)})});
app.get("/api/me",auth,async(req,res)=>res.json((await db("SELECT id,name,email,phone,role FROM users WHERE id=$1",[req.user.id]))[0]));
app.get("/api/orders",auth,async(req,res)=>res.json(await db(`SELECT o.*,u.name client_name,(SELECT count(*) FROM offers f WHERE f.order_id=o.id) offer_count FROM orders o JOIN users u ON u.id=o.client_id ORDER BY o.created_at DESC`)));
app.post("/api/orders",auth,async(req,res)=>{const {category,description,area,budget,place,work_date}=req.body;if(!category||!place)return res.status(400).json({error:"Norādi pakalpojumu un vietu"});res.json((await db(`INSERT INTO orders(client_id,category,description,area,budget,place,work_date) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,[req.user.id,category,description||"",area||null,budget||null,place,work_date||null]))[0])});
app.get("/api/orders/:id/offers",auth,async(req,res)=>res.json(await db(`SELECT f.*,u.name worker_name,u.phone worker_phone FROM offers f JOIN users u ON u.id=f.worker_id WHERE f.order_id=$1 ORDER BY f.price ASC`,[req.params.id])));
app.post("/api/orders/:id/offers",auth,async(req,res)=>{const {price,note}=req.body;if(!price)return res.status(400).json({error:"Norādi cenu"});const o=(await db("SELECT * FROM orders WHERE id=$1",[req.params.id]))[0];if(!o)return res.status(404).json({error:"Pasūtījums nav atrasts"});res.json((await db(`INSERT INTO offers(order_id,worker_id,price,note) VALUES($1,$2,$3,$4) RETURNING *`,[o.id,req.user.id,price,note||""]))[0])});
app.post("/api/orders/:id/select/:offerId",auth,async(req,res)=>{const o=(await db("SELECT * FROM orders WHERE id=$1 AND client_id=$2",[req.params.id,req.user.id]))[0];if(!o)return res.status(403).json({error:"Nav piekļuves"});await db("UPDATE orders SET status='worker_selected' WHERE id=$1",[o.id]);res.json({ok:true})});
app.get("/api/orders/:id/messages",auth,async(req,res)=>res.json(await db(`SELECT m.*,u.name sender_name FROM messages m JOIN users u ON u.id=m.sender_id WHERE m.order_id=$1 ORDER BY m.created_at`,[req.params.id])));
app.post("/api/orders/:id/messages",auth,async(req,res)=>{if(!req.body.body)return res.status(400).json({error:"Ziņa ir tukša"});res.json((await db("INSERT INTO messages(order_id,sender_id,body) VALUES($1,$2,$3) RETURNING *",[req.params.id,req.user.id,req.body.body]))[0])});
app.get("/api/admin/users",auth,admin,async(req,res)=>res.json(await db("SELECT id,name,email,phone,role,created_at FROM users ORDER BY id DESC")));
app.get("/api/admin/orders",auth,admin,async(req,res)=>res.json(await db("SELECT o.*,u.name client_name,u.email client_email FROM orders o JOIN users u ON u.id=o.client_id ORDER BY o.id DESC")));
app.get("/api/admin/stats",auth,admin,async(req,res)=>res.json({users:(await db("SELECT count(*) n FROM users"))[0].n,orders:(await db("SELECT count(*) n FROM orders"))[0].n,offers:(await db("SELECT count(*) n FROM offers"))[0].n}));
app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
init().then(()=>app.listen(process.env.PORT||3000,()=>console.log("Meistars.lv running"))).catch(e=>{console.error(e);process.exit(1)});
