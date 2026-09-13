# Bonamassa Painel

Painel web de operação da pizzaria, integrado ao [APIBonamassa](https://github.com/nvpetri/APIBonamassa), com a identidade visual Bonamassa. **Versão 0.4.0: login e dados reais da API.**

## Executar com a API que já está rodando

Use Node.js 24. A API deve estar disponível em `http://127.0.0.1:3001`, com as migrações aplicadas e o gerente cadastrado pelo seed.

Na pasta do painel, com esta versão do código:

```powershell
npm ci
npm run setup
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000). Entre com o **SEED_MANAGER_EMAIL** e a senha **SEED_MANAGER_PASSWORD** que você configurou no `.env` da API. O painel não cria uma senha padrão.

`npm run setup` gera `.env.local` e uma chave exclusiva de sessão; preserva um arquivo existente. Se a API usa outra porta ou outro computador, ajuste `API_URL` em `.env.local` e reinicie o painel. Use a origem, sem `/v1` no final.

```dotenv
PANEL_MODE=api
API_URL=http://127.0.0.1:3001
STORE_SLUG=bonamassa
SESSION_SECRET=chave-exclusiva-gerada-pelo-setup
COOKIE_SECURE=false
```

Não copie a chave de exemplo: execute o setup para gerá-la. Os arquivos de ambiente não entram no Git.

No PowerShell, se `npm.ps1` for bloqueado, use `npm.cmd` nos comandos acima ou abra o Prompt de Comando.

## Acessar pelo celular, tablet ou outro PC

Com os dispositivos na mesma rede, abra **http://IP-DO-PC:3000** no navegador. O Next.js já escuta em `0.0.0.0`. Libere a porta TCP 3000 no Firewall do Windows para a rede privada se necessário.

A configuração `API_URL` é vista pelo servidor do painel. Quando painel e API rodam no mesmo PC, ela continua sendo `http://127.0.0.1:3001`, inclusive quando o navegador está no celular. Não precisa liberar CORS para cada IP do navegador: a conexão à API passa pelo servidor Next.js.

Para homologação por HTTPS, use `COOKIE_SECURE=true`. `false` é destinado aos testes locais por HTTP. O painel usa cookie HttpOnly, SameSite Strict, sessão criptografada e valida a origem das alterações. Tokens de acesso não são enviados ao JavaScript do navegador.

## Roteiro de teste

1. Entre como gerente. Abra **Configurações → Nova conta** e cadastre uma conta de cozinha e uma de entregador.
2. Em **Cardápio**, cadastre um sabor com foto, ajuste preços e confira a composição dos combos. Eles mantêm preço próprio e pizzas inteiras ou meio a meio.
3. Em **Promoções**, crie um desconto por percentual ou valor, com prazo, quantidade ou ambos. Os contadores de reservadas/vendidas vêm da API.
4. Abra a loja em **Pedidos**, se estiver pausada. Crie um pedido de balcão/WhatsApp, escolha produtos e promoção, clique em **Revisar pedido** e confira os valores antes de confirmar.
5. Clique em **Aceitar pedido**, em verde. O cancelamento fica logo abaixo, em vermelho, para o gerente.
6. Em outro navegador, sessão anônima ou dispositivo, entre com a conta da cozinha. Inicie o preparo e marque como pronto. A cozinha recebe somente a projeção de produção, sem cliente, telefone, endereço ou preços.
7. No gerente, abra **Entregas** e atribua o pedido. A coleta, saída e conclusão devem ser enviadas por uma sessão de entregador à API; o painel acompanha essas etapas.
8. Confira o pedido encerrado em **Histórico** e os contadores da promoção. Para retirada no balcão, o atendimento pode confirmar o recebimento diretamente pelo painel.

As telas atualizam a cada **5 segundos** enquanto visíveis, também ao recuperar o foco ou a conexão. Há botão de atualização manual e aviso quando os dados ficam desatualizados. WebSockets podem ser adicionados depois; esta versão já reconcilia o estado por REST.

Os apps Android permanecem em repositórios separados. **Esta alteração integra o painel; não altera nem conecta automaticamente as demos Android.** Para testar a última etapa antes da integração do app do entregador, use os endpoints `/v1/driver/deliveries/{id}/collect`, `/start` e `/complete` da API com o login do entregador, `expectedVersion` e `Idempotency-Key`.

## Acessos e limites

| Conta                | Acesso no painel                                                              |
| -------------------- | ----------------------------------------------------------------------------- |
| Gerente              | Pedidos, cozinha, entregas, catálogo, promoções, histórico, operação e equipe |
| Atendimento          | Pedidos manuais, aceite, atribuição, retirada, devolução e histórico          |
| Cozinha              | Fila de produção; iniciar preparo e marcar pronto                             |
| Entregador / cliente | Usam seus próprios aplicativos; login recusado no painel                      |

O backend verifica novamente a autorização em cada operação. Alterações enviam a versão exibida; um conflito pede que o operador reveja os dados. Pedidos e valores anteriores não são regravados quando o catálogo muda.

O histórico começa com 100 pedidos e possui **Carregar mais pedidos**. Todos os pedidos ativos são buscados separadamente; a busca do histórico considera somente os registros carregados. Totais de descontos no painel de promoções indicam explicitamente esse recorte; as cotas usam os contadores completos do servidor. A cozinha usa referência visual de 45 minutos.

As solicitações de negócio usam idempotência. Se a resposta se perder, o painel guarda somente a operação pendente em IndexedDB e permite consultar **a mesma solicitação** após recarregar. Não envia um novo pedido para tentar adivinhar o resultado. O registro é separado por unidade e usuário e apagado ao receber confirmação definitiva. Pedidos já carregados, senhas e tokens não são armazenados ali. Contas da equipe usam repetição em memória e unicidade de e-mail; senhas nunca são persistidas no navegador.

PIX/gateway, WhatsApp automático, fiscal, rastreamento, relatórios de caixa e troca de senha pela interface não entram nesta integração. Pagamentos manuais são dinheiro ou cartão na entrega/retirada. A API continua sendo responsável por regras, totais, cotas, autorização e persistência.

## Demonstração local opcional

A demonstração anterior continua disponível quando **PANEL_MODE=demo** em `.env.local`, seguida de reinício do servidor. Ela usa IndexedDB, pedidos fictícios e ações simuladas, sem API. Não há fallback automático para demo quando a API falha.

## Desenvolvimento e verificação

```bash
npm run lint
npm run typecheck
npm test
npm run build
# Demonstração: definir PANEL_MODE=demo no ambiente do processo
npm run test:e2e
# API real + PostgreSQL de teste, com seed de demonstração e credenciais no ambiente
npm run test:api
```

O GitHub Actions executa dois trabalhos: regressão da demo e integração com PostgreSQL 17 + APIBonamassa na revisão `c9fcefad3827343a27abd5b0d14970a935b182b5`. O segundo testa pelo navegador login, equipe, fotos, catálogo, combo, promoção, pedido, cozinha, despacho, conclusão, permissões e uma resposta perdida após gravar o pedido.

Use um banco **exclusivo para testes**: esses cenários criam contas e pedidos. As credenciais declaradas no workflow são somente desse banco efêmero.

Para execução otimizada: `npm run build` e `npm start`. Mantenha os arquivos de ambiente apenas no servidor.

Veja [o contrato da integração](docs/INTEGRACAO.md) e [o registro de verificação](docs/VERIFICACAO.md).
