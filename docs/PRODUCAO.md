# Painel Bonamassa em produção

Parte do [manual operacional completo](https://github.com/nvpetri/APIBonamassa/blob/codex/preparacao-producao/docs/producao/README.md). Nenhum serviço foi contratado/deployado por esta preparação.

## Configuração no Render

Este é um **Web Service Node**, não um Static Site. O BFF do painel mantém o token no servidor, usando cookie criptografado no navegador.

- Build: `npm ci && npm run build`.
- Start: `npm run start:production`.
- Health check: `/`. Isso não testa login ou banco; conferir o fluxo separado.
- Node: seguir .nvmrc do repositório.
- Ambiente: NODE_ENV=production, APP_ENV=production (ou staging no ensaio), PANEL_MODE=api.
- API_URL: origem HTTPS da API, sem /v1.
- PANEL_ORIGIN: origem HTTPS exata pela qual a equipe entra no painel.
- STORE_SLUG: unidade existente na API.
- COOKIE_SECURE=true.
- SESSION_SECRET: segredo aleatório de 32 bytes, representado em 64 caracteres hexadecimais.

Modelo: [.env.production.example](../.env.production.example). Valores privados ficam em Environment/cofre, nunca no Git ou em NEXT_PUBLIC_*.

```powershell
npm ci
npm run production:check
npm run build
```

O check lê .env.local quando existir. No Render, usar as variáveis do serviço. Ele valida configuração, não conecta na API nem comprova backups.

NODE_ENV=production ativa verificações por padrão. APP_ENV=test é exclusivamente para testes descartáveis com HTTP local; não usar na nuvem para contornar erro de segurança. Os testes de navegador definem essa exceção explicitamente.

## Mudanças que afetam a atualização

Em produção, o painel recusa API HTTP, cookie inseguro, segredo curto e origem de mutação diferente de PANEL_ORIGIN. **Configurar os valores antes de liberar o deploy deste PR.**

Rotacionar SESSION_SECRET exige novo login. Alterar API_URL ou STORE_SLUG também invalida o vínculo da sessão. Trocar domínio exige atualizar PANEL_ORIGIN, conferir DNS/certificado e testar operações no novo endereço.

Os cabeçalhos impedem enquadramento em outros sites e restringem recursos estruturais. A CSP desta etapa não bloqueia todos os scripts inline: uma política completa com nonces continua sendo uma evolução, não uma proteção já certificada contra XSS.

## Validação prática em homologação

1. Gerente entra; cozinha/atendimento entram com suas próprias contas.
2. Cookie mostra HttpOnly, Secure e SameSite, sem token visível em JavaScript.
3. Produto/foto/preço, combo/promoção e horários salvam normalmente.
4. Reserva não chega à cozinha antes da liberação; abertura antecipada pede confirmação.
5. Dois operadores editando o mesmo pedido recebem conflito tratável.
6. Logout, usuário desativado e senha alterada revogam o acesso.
7. Abrir o painel em iframe de outra origem é bloqueado; mutação com origem incorreta é recusada.
8. O domínio real funciona; o nome onrender antigo não é usado indevidamente como origem de escrita.

## Problemas comuns

| Sintoma | Conferir |
| --- | --- |
| Start reprovado | Variáveis, HTTPS, segredo e APP_ENV; não publicar valores em logs |
| Login retorna 503 | API/banco disponíveis, URL e timeout; não desligar TLS |
| Mutação bloqueada por origem | PANEL_ORIGIN e endereço usado pela equipe, incluindo esquema e porta |
| Cookie não persiste | HTTPS real e COOKIE_SECURE=true |
| Muitos 429 | Limites e IP compartilhado do BFF; não confiar em XFF do navegador |
| Painel abre, mas API falha | Health do painel é independente; conferir /v1/health da API |

## Dependência de publicação

Este PR foi criado sobre o PR #6 de horários. Depois de aprová-lo/mesclá-lo, conferir a base deste PR e CI em main. Coordenar com a API; não acionar deploy automático no meio da migração.

[Configuração completa](https://github.com/nvpetri/APIBonamassa/blob/codex/preparacao-producao/docs/producao/02-CONFIGURACAO.md), [deploy/rollback](https://github.com/nvpetri/APIBonamassa/blob/codex/preparacao-producao/docs/producao/03-DEPLOY.md), [backup](https://github.com/nvpetri/APIBonamassa/blob/codex/preparacao-producao/docs/producao/04-BACKUP.md) e [checklist de liberação](https://github.com/nvpetri/APIBonamassa/blob/codex/preparacao-producao/docs/producao/06-CHECKLIST.md).
