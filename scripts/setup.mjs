import { randomBytes } from "node:crypto";
import { writeFileSync, existsSync } from "node:fs";

if (existsSync(".env.local")) {
  console.log(
    ".env.local já existe e foi preservado. Confira API_URL e STORE_SLUG nesse arquivo.",
  );
} else {
  writeFileSync(
    ".env.local",
    `PANEL_MODE=api\nAPI_URL=http://127.0.0.1:3001\nSTORE_SLUG=bonamassa\nSESSION_SECRET=${randomBytes(48).toString("base64url")}\n# false somente para os testes locais por HTTP\nCOOKIE_SECURE=false\n`,
    { flag: "wx", mode: 0o600 },
  );
  console.log(
    "Painel configurado para a API em http://127.0.0.1:3001. Execute npm run dev e entre com o gerente cadastrado na API.",
  );
}
