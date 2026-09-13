# Verificação — integração com a API (0.4.0)

A integração mantém a regressão da demonstração e acrescenta contratos, sessão e um percurso de navegador com APIBonamassa e PostgreSQL 17 reais em banco efêmero.

- Build de produção, TypeScript e ESLint passaram.
- 69 testes de regras, mapeamento e sessão passaram.
- 21 cenários da demonstração passaram no GitHub Actions.
- Login conferido em 1440×1000 e 390×844: sem erros de JavaScript ou transbordamento horizontal.
- O job `integration` da PR #5 executa: gerente, cadastro da equipe, sabor com foto, alteração de combo, promoção por prazo/quantidade, revisão do pedido no servidor, aceite, cozinha em outra sessão, despacho, conclusão via sessão do entregador, histórico, reserva/venda da promoção, permissões, CSRF e recuperação após perder a resposta de uma criação já gravada.

Os resultados do código publicado estão nos [checks da PR #5](https://github.com/nvpetri/BonamassaPainel/pull/5/checks). O workflow fixa a revisão da API; não depende do servidor local do desenvolvedor. Os APKs Android não fazem parte deste teste: as etapas de entregador são enviadas diretamente à API pelo cliente de teste autenticado.

Os registros abaixo são históricos da demo, com o escopo e os números daquela versão.

---

# Verificação do painel — formato e desconto dos combos

Validação executada em 13/09/2026, em Linux com Node.js 24.19.0.

## Resultados

| Verificação                      | Resultado                                                                                                                                                                                       |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Compilação Next.js para produção | Aprovada; sete telas e página de entrada geradas                                                                                                                                                |
| TypeScript                       | Sem erros                                                                                                                                                                                       |
| ESLint                           | Sem erros ou avisos                                                                                                                                                                             |
| Vitest                           | 63 testes de regras aprovados                                                                                                                                                                   |
| Playwright / Chromium            | 21 cenários aprovados na execução completa                                                                                                                                                      |
| Axe / WCAG A e AA                | Nenhuma violação detectada nos sete caminhos em desktop e no formulário de novo pedido em viewport mobile; promoções, sabores com foto e categorias, meio a meio e cadastro de combo em celular |
| Responsividade                   | Sem transbordamento horizontal da página nos sete caminhos a 1440×1000 e 390×844; a tabela tem rolagem própria                                                                                  |

## O que foi exercitado

1. Pedido grande de dois sabores, borda e bebida; total R$ 94,00, dinheiro R$ 100,00 e troco R$ 6,00. Aceite, preparo, pedido pronto, atribuição, coleta, saída, conclusão e histórico após recarregar.
2. Duas abas do mesmo navegador: pedido aceito aparece na cozinha; mudança de preparo volta ao atendimento; duas criações concorrentes mantêm números distintos e nenhum pedido é perdido.
3. Cancelamento com motivo e entrega sem sucesso seguida de retorno/devolução. Ambos permanecem separados das vendas concluídas. Exportação CSV exercitada.
4. Alteração persistente de preço e disponibilidade, bloqueio de sabor pausado, aviso de dinheiro insuficiente dentro do modal e pausa da loja após recarregar.
5. Snapshot inválido mostra recuperação e não é substituído ao tentar novamente. Reinício explícito recupera os exemplos.
6. Navegação por todas as telas em desktop/mobile, abertura do menu mobile, formulário, Escape para fechar, ausência de erros JavaScript e auditoria automatizada de acessibilidade.

7. Promoção de R$ 10 limitada a duas pizzas em um pedido com três unidades: desconto de R$ 20, total de R$ 152 e troco de R$ 48 para R$ 200. Persistência, cancelamento liberando cota e edição preservando o snapshot histórico.
8. Duas abas disputando a última pizza promocional: só um pedido criado e nenhuma unidade além do limite.
9. Promoção por prazo: pausar/habilitar, encerramento exato com formulário aberto, bloqueio de envio e revisão do total ao remover a oferta.
10. Migração do IndexedDB versão 1 para 4 (snapshot do schema 1 para 3), preservando todos os pedidos, preços de catálogo, numeração e preferências após navegação e recarregamento.
11. Cartões de promoções e formulário com prazo e quantidade em desktop/mobile, sem transbordamento ou violações WCAG A/AA detectadas.

12. Cadastro de sabor com PNG de 2.400 × 1.600 pixels, otimização para 1.200 pixels no maior lado e até 200 KB, exibição no cartão, persistência e preço da meia pizza com o novo sabor. Abertura da versão antiga do banco é recusada sem apagar a foto.
13. Envio de JPEG e WebP, substituição, remoção e cancelamento da edição. SVG, arquivo acima de 10 MB e JPEG corrompido mostram erro mantendo a foto anterior. Pedidos e preços antigos permanecem iguais.
14. Nome duplicado e preço zero são recusados. Cadastro de sabor pausado e ativação em outra aba são refletidos no cardápio.
15. Seleções rápidas de fotos com decodificação atrasada: prevalece o último arquivo. Formulário de cadastro com foto em desktop e celular, sem transbordamento nem violações WCAG A/AA detectadas.

16. Cadastro de nova borda por R$ 15 e bebida por R$ 18, persistência após recarregar e pedido de retirada com mussarela grande, borda e bebida por R$ 88.
17. Mudança de grupo sem duplicar sabor, filtros de tradicionais/especiais e meio a meio com preço do maior sabor mais borda; a prévia abre um pedido com a combinação correta.
18. Cadastro de combo exige composição. Pedido de dois combos por R$ 80 mais R$ 7 de entrega soma R$ 167. Cozinha e detalhe exibem duas pizzas, quatro refrigerantes, borda e observações. Pausar a borda em outra aba bloqueia novas vendas do combo e preserva o pedido existente.
19. Categorias, prévia meio a meio e cadastro de combo em 390×844 sem transbordamento horizontal ou violações Axe A/AA detectadas.

20. Combo alterna de inteira para meio a meio e volta a inteira pela edição da linha. Escolher o primeiro sabor igual ao segundo mantém meio a meio e exige outra metade. A edição incompleta bloqueia o salvamento, e o resumo usa maior sabor, tamanho, borda e quantidades. Após salvar, dois combos de R$ 135 + entrega de R$ 7 somam R$ 277. Alterar depois a composição e o preço para R$ 140 preserva o pedido anterior e atualiza somente novos pedidos.
21. Preço zero é recusado; valor acima da soma não aparece como desconto. O botão para usar o preço avulso gera economia zero; cancelar a edição da linha e fechar o formulário não alteram o cadastro salvo. Formulário e formato da pizza foram auditados em 390×844 sem violações Axe A/AA detectadas.

Quatro testes de regras específicos verificam a comparação de preços com tamanho, quantidades, maior metade e bordas; economia nula/negativa; valores inválidos; atualização da referência sem reprecificar o combo; e consulta de componentes pausados sem liberar a venda. O cálculo usa centavos; o percentual mostrado é arredondado para até duas casas.

A conferência visual verificou o aceite verde e o cancelamento vermelho logo abaixo, com mesma largura e espaçamento nos cartões em desktop/mobile e no detalhe do pedido. O cancelamento continua exigindo motivo e confirmação. A execução completa atual também cobriu o estado de processamento da foto e a confirmação da gravação antes de recarregar/navegar. Não foram instaladas dependências novas.

Os nove testes de domínio de categorias cobrem grupos, borda cadastrável/pausada, preço fixo e snapshots dos combos, disponibilidade dos componentes, referências inválidas e ciclos, alteração concorrente da receita, exclusão de combos das promoções, migração de fotos/preços/pedidos e catálogo anterior com 100 produtos.

Os testes de fotos usam imagens sintéticas geradas pelo navegador, sem fotos de clientes ou downloads externos. Os testes de domínio de catálogo verificam IDs/nomes duplicados, limite de produtos, preços, sabores pausados, edição concorrente, preservação do histórico e exportação das imagens no JSON.

Os testes de domínio adicionais cobrem percentual e arredondamento por unidade, desconto fixo limitado ao preço da pizza, exclusão de borda/bebida/taxa, retirada com total zero, limites combinados, cotação desatualizada, cancelamento/devolução, conversão de reserva em venda, edição concorrente, snapshots imutáveis, migração e horário de Brasília.

Os testes unitários verificam regras de preço, versões antigas, saltos de estado, horários, dados inválidos, disponibilidade do motoboy, carga de vários pedidos, pagamentos e neutralização de fórmulas no CSV.

## Limites desta validação

- Os testes de navegador usaram Chromium 153 headless, obtido pelo pacote de runtime `@sparticuz/chromium` devido a indisponibilidade do download padrão do Playwright neste ambiente. Ele não é dependência do painel nem está versionado no repositório.
- O caminho de navegador alternativo é configurável em `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. Em computadores comuns e no workflow, a instalação normal é `npx playwright install chromium`.
- Testes automatizados e auditoria Axe não substituem avaliação humana completa de acessibilidade. Firefox, Safari, dispositivos físicos, touchscreen de cozinha, impressão térmica e áudio em equipamentos reais ainda precisam de homologação.
- As capturas `pedidos.png`, `cozinha.png`, `entregas.png` e `promocoes.png` são imagens do aplicativo executado, com dados de demonstração.
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
