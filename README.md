# PetalHub (Node.js + MySQL)

1. Run this in terminal `npm install`
2. In the MySQL command prompt (`mysql -u root -p`) 
create the tables:
   `SOURCE C:/path/to/petalhub/schema.sql;`
3. Start the server (Command Prompt on Windows):
   set DB_USER=root
   set DB_PASSWORD=your_mysql_password
   set ADMIN_EMAIL=admin@petalhub.com
   set ADMIN_PASSWORD=petalhub2026
   node server.js
4. Open http://localhost:3000

Optional: DB_HOST, DB_PORT, DB_NAME (default petalhub), PORT.
Check the data from the MySQL prompt: `USE petalhub; SELECT * FROM orders;`
