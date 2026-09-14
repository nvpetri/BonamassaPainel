import { productionSettings } from "./production-config.mjs";

try {
  productionSettings();
  console.log("Configuração validada: modo API, HTTPS, origem do painel e cookie seguro.");
  console.log("Check local: não comprova disponibilidade, backups ou proteção completa.");
} catch {
  console.error("Configuração de produção reprovada. Consulte docs/PRODUCAO.md. Nenhum segredo foi impresso.");
  process.exitCode = 1;
}
