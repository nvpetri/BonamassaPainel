# Verificação da versão 0.1.0-demo

Validação executada em 13/09/2026, em Linux com Node.js 24.19.0.

## Resultados

| Verificação                      | Resultado                                                                                                      |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Compilação Next.js para produção | Aprovada; seis telas e página de entrada geradas                                                               |
| TypeScript                       | Sem erros                                                                                                      |
| ESLint                           | Sem erros ou avisos                                                                                            |
| Vitest                           | 21 testes de regras aprovados                                                                                  |
| Playwright / Chromium            | 6 cenários aprovados                                                                                           |
| Axe / WCAG A e AA                | Nenhuma violação detectada nos seis caminhos em desktop e no formulário de novo pedido em viewport mobile      |
| Responsividade                   | Sem transbordamento horizontal da página nos seis caminhos a 1440×1000 e 390×844; a tabela tem rolagem própria |

## O que foi exercitado

1. Pedido grande de dois sabores, borda e bebida; total R$ 94,00, dinheiro R$ 100,00 e troco R$ 6,00. Aceite, preparo, pedido pronto, atribuição, coleta, saída, conclusão e histórico após recarregar.
2. Duas abas do mesmo navegador: pedido aceito aparece na cozinha; mudança de preparo volta ao atendimento; duas criações concorrentes mantêm números distintos e nenhum pedido é perdido.
3. Cancelamento com motivo e entrega sem sucesso seguida de retorno/devolução. Ambos permanecem separados das vendas concluídas. Exportação CSV exercitada.
4. Alteração persistente de preço e disponibilidade, bloqueio de sabor pausado, aviso de dinheiro insuficiente dentro do modal e pausa da loja após recarregar.
5. Snapshot inválido mostra recuperação e não é substituído ao tentar novamente. Reinício explícito recupera os exemplos.
6. Navegação por todas as telas em desktop/mobile, abertura do menu mobile, formulário, Escape para fechar, ausência de erros JavaScript e auditoria automatizada de acessibilidade.

Os testes unitários verificam regras de preço, versões antigas, saltos de estado, horários, dados inválidos, disponibilidade do motoboy, carga de vários pedidos, pagamentos e neutralização de fórmulas no CSV.

## Limites desta validação

- Os testes de navegador usaram Chromium 153 headless, obtido pelo pacote de runtime `@sparticuz/chromium` devido a indisponibilidade do download padrão do Playwright neste ambiente. Ele não é dependência do painel nem está versionado no repositório.
- O caminho de navegador alternativo é configurável em `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. Em computadores comuns e no workflow, a instalação normal é `npx playwright install chromium`.
- Testes automatizados e auditoria Axe não substituem avaliação humana completa de acessibilidade. Firefox, Safari, dispositivos físicos, touchscreen de cozinha, impressão térmica e áudio em equipamentos reais ainda precisam de homologação.
- As capturas `pedidos.png`, `cozinha.png` e `entregas.png` são imagens do aplicativo executado, com dados de demonstração.
- O workflow de CI está incluído; seu resultado no GitHub deve ser consultado na aba Actions. Os resultados acima se referem à execução local registrada nesta entrega.
- Integração entre aparelhos/apps, autenticação, backend, cobrança e GPS não foram testados porque ainda não foram implementados.

## Repetir localmente

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Não é necessário subir o servidor manualmente para os testes: o Playwright gerencia seu ciclo de vida. O projeto usa ESLint 9, compatível com os plugins do Next.js fixados no lockfile.
