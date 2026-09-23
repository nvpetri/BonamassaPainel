# Integração implementada — painel 0.4.0

Referência: APIBonamassa `dad549c6225115c018e2d38e42b1c2b1965a6771`, a mesma revisão fixada nos testes dos aplicativos cliente e entregador.

O navegador conversa com o servidor Next.js na mesma origem. `API_URL` e `SESSION_SECRET` são variáveis apenas do servidor. Os Route Handlers de `/api/session` e `/api/backend/[...path]` trocam o cookie criptografado pelo Bearer da API. Não existe proxy de URL arbitrária: métodos e caminhos são limitados aos contratos do painel. Escritas validam Origin/Host e recebem Idempotency-Key. A API continua validando usuário, unidade e perfil.

| Operação                           | Contrato da API                                                                                                |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Entrar / identificar / sair        | POST `/v1/sessions`, GET `/v1/me`, DELETE `/v1/sessions/current`                                               |
| Catálogo, disponibilidade e preços | GET `/v1/staff/catalog`, POST/PATCH `/v1/staff/products`                                                       |
| Foto                               | POST multipart `/v1/staff/product-images`, GET `/v1/stores/{slug}/images/{id}`                                 |
| Promoções                          | POST/PATCH `/v1/staff/promotions`                                                                              |
| Operação da loja                   | PATCH `/v1/staff/store`                                                                                        |
| Equipe e disponibilidade           | GET/POST/PATCH `/v1/staff/users`, GET `/v1/staff/drivers`, PATCH disponibilidade                               |
| Revisão e pedido manual            | POST `/v1/orders/quote`, POST `/v1/staff/orders` com quoteId                                                   |
| Pedidos / cozinha                  | GET paginado `/v1/staff/orders`; projeção conforme o papel                                                     |
| Etapas da operação                 | POST `/v1/staff/orders/{id}/accept`, `/prepare`, `/ready`, `/assign`, `/pickup-complete`, `/cancel`, `/return` |

## Consistência

- Cada comando conserva a versão exibida ao iniciar a ação. Edição de produto usa a versão da instância original do formulário, inclusive se uma atualização automática chegar enquanto ele está aberto.
- Preços da montagem são apenas referência. A tela de revisão exibe o snapshot calculado pela API e envia somente quoteId na criação.
- Cotas de promoções usam os contadores reservados/vendidos da API. Nunca são reconstituídas de um histórico incompleto.
- As requisições pendentes sobrevivem a reload em IndexedDB, separadas por usuário/unidade. Chaves são mantidas após falha ambígua (rede/5xx). Uma resposta confirmada permanece sucesso mesmo se a leitura seguinte falhar.
- Catálogo, equipe e pedidos ficam somente em memória. Fotos são otimizadas no navegador, enviadas ao backend e associadas pelo imageId.
- A lista busca todos os estados ativos, além das páginas carregadas do histórico. Se um pedido aparecer em duas consultas concorrentes, prevalece a versão maior.
- Leituras antigas não podem sobrescrever uma reconciliação iniciada depois. Atualização periódica, foco e reconexão recuperam alterações de outros clientes.
- A API não expõe totais/cliente/endereço à conta KITCHEN. O painel não inventa valores para preencher esse DTO.

## Continuidade

Os aplicativos Android cliente e entregador usam os mesmos contratos da API, loja, pedidos e versões. Cada perfil executa suas ações autorizadas. O painel renova o cookie criptografado com a validade confirmada pela API em cada consulta de sessão e operação autenticada: a sessão expira após cinco dias sem uso. Confirmação de e-mail e recuperação de senha da equipe são acessíveis na tela de entrada; os testes de integração exercitam esses fluxos com PostgreSQL e o provedor de e-mail isolado de teste.

Os requisitos ainda sujeitos à validação da pizzaria (preço do meio a meio, área/taxa de entrega, pagamentos, fiscal, fotos reais, acesso de funcionários) permanecem decisões de produto; esta integração usa os contratos existentes da API.

## Dashboard do gerente

Acesse `/dashboard` com a função **Gerente**. O menu é exclusivo desta função; a API também recusa atendentes, cozinha, entregadores e clientes. O modo demo continua com as telas operacionais; o dashboard utiliza dados reais no modo API.

Filtros: hoje, últimos 7 ou 30 dias e intervalo personalizado de até 366 dias, sempre no calendário de São Paulo. A atualização ocorre a cada 30 segundos com a página visível, ao retornar à janela ou pelo botão Atualizar dados. Falhas mostram um aviso e preservam somente o último resultado do mesmo período. Respostas atrasadas de filtros anteriores são descartadas.

O painel apresenta vendas concluídas, pizzas (avulsas e combos), ticket médio, pedidos recebidos, gráfico diário com tabela acessível, canais Aplicativo/WhatsApp/Balcão, formas de pagamento, descontos, fretes e comissões. Recebidos usam a data de criação; vendas e encerramentos usam sua data de conclusão. Cancelados e devolvidos não contam como vendas. O saldo após comissões não é lucro nem conciliação de pagamentos.

A fila de pedidos e a disponibilidade dos motoboys refletem a situação atual, independente do período; entregas concluídas, devoluções e comissões respeitam o filtro. Disponibilidade declarada não equivale a presença online. Motoboys desabilitados permanecem no histórico.

Pedidos antigos com combos sem quantidade histórica registrada geram um aviso de contagem parcial de pizzas. Valores em reais permanecem completos. A agregação ocorre em `GET /v1/staff/dashboard?from=AAAA-MM-DD&to=AAAA-MM-DD`, incluindo todo o histórico, sem o limite de paginação da tela de pedidos. Atualize a API antes do painel; esta versão não exige nova variável de ambiente ou migração de banco.
