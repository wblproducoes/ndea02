# Presença em Tempo Real

## Requisitos
- Node.js 18+
- MySQL/MariaDB

## Configuração
- Copie `.env.example` para `.env` e ajuste variáveis.
- Crie o banco e execute `server/db/ddl.sql`.
- Instale dependências: `npm install`.
- Inicie: `npm start` e abra `http://localhost:3000/`.

## Endpoints
- `GET /api/tables`
- `POST /api/register-station { session_key }`
- `GET /api/records?table_id=`
- `POST /api/record/:id/toggle { field, table_id }`
- `GET /api/counters`
- `POST /admin/upload-excel` (file `xlsx`, `password`, `table_id`)
- `POST /admin/reset` (`password`)
- `POST /admin/rename-table` (`table_id`, `new_name`, `password`)

## Deploy no cPanel
- Crie App Node (Passenger) e configure `server/app.js` como Start-up file.
- Configure `.env` com credenciais e senha.
- Execute `server/db/ddl.sql` no MySQL.
- `package.json` já possui `start` para o Passenger.

## Template Excel
- Gere com `npm run make:template`. O arquivo é `scripts/template.xlsx`.
