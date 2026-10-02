# Meistars.lv — full-stack

## Kas ir iekšā
- Node.js + Express API
- PostgreSQL datubāze
- JWT autentifikācija
- klienta/meistara/admin lomas
- pasūtījumi
- piedāvājumi
- čata ziņas
- admin statistika un lietotāju/pasūtījumu pārvaldības sākums
- aizsardzība ar Helmet + rate limiting
- telefona PWA/SPA frontend

## Lai palaistu internetā
Nepieciešams:
1. PostgreSQL datubāze.
2. Node hosting (piem., Render/Railway/Hostinger VPS).
3. Mainīgie:
   DATABASE_URL
   JWT_SECRET
   ADMIN_EMAIL=sado12342@inbox.lv
   ADMIN_PASSWORD=<tava stipra parole>

Drošības dēļ parole nav ielikta projektā. Pēc pirmās palaišanas admin konts tiek izveidots automātiski, ja ADMIN_EMAIL/ADMIN_PASSWORD ir iestatīti.

## Svarīgi
No šīs sarunas es nevaru pats izveidot ārēju hosting kontu, nopirkt domēnu vai publicēt vietni bez piekļuves attiecīgajam hostingam/domenam. Šis projekts ir sagatavots deploy vajadzībām.
