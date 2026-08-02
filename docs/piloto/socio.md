# Tutela — Guia do Sócio Administrador

Como ler o painel, o que auditar, quando reagir.

Acesso: `<url-da-banca>/painel` (só quem tem `role: owner` ou `manager` no Clerk vê).

---

## Os 4 KPIs no topo

### 🛡 Consultas protegidas
Quantas requisições passaram pela anonimização com dado sensível detectado. O `%` mostra a taxa de proteção sobre o total.
- **Alto (>80%)**: a banca trabalha com dados sensíveis e a proteção está atuando — bom sinal
- **Zero**: ou ninguém está usando, ou estão usando só para perguntas genéricas (sem colar peças reais)

### ✨ Dados tarjados
Total de **entidades** substituídas por tokens antes de sair para o LLM. Um documento com 5 nomes + 2 CPFs conta 7.
- Cresce linearmente com o uso — é a métrica mais concreta de "quanta PII eu evitei de vazar"

### 🔎 Citações sinalizadas
Quantas jurisprudências/legislações a IA citou que a verificação **não confirmou** ou marcou divergente. **Este é o mais importante.**
- **> 0**: pelo menos uma vez a IA inventou (ou pegou errado) uma citação. Se algum advogado ignorou o semáforo vermelho e protocolou, a banca tem exposição
- Zero é o objetivo — mas > 0 não é bug, é evidência de que a verificação **está fazendo o trabalho**

### 💰 Custo por IA no período
USD gastos com OpenAI/Anthropic no período filtrado. Se houve bloqueio por DLP ou budget, aparece embaixo.
- Compare com o custo teórico se cada advogado tivesse ChatGPT Plus ($20 × N seats)

---

## Filtros

- **Área**: recorta por Cível / Trabalhista / etc.
- **Advogado**: recorta por pessoa. Útil quando um só está consumindo demais
- **Janela**: 7 / 30 / 90 dias

---

## Ações típicas do sócio

### Toda semana (10 minutos)
1. Abrir o painel na janela **7 dias**
2. Olhar "Citações sinalizadas" — se > 0, filtrar por advogado que gerou → conversar com ele sobre o caso
3. Olhar "Custo por área" — alguma área extrapolou o esperado?

### Toda 1ª segunda do mês (20 minutos)
1. Janela **30 dias**
2. Baixar **CSV de conformidade** (botão no topo direito)
3. Guardar em pasta compartilhada — evidência para DPO / cliente / auditoria externa
4. Comparar consumo do mês vs. planejado

### Quando um advogado reclamar da IA
1. Filtrar por ele + janela **7 dias**
2. Ver se as tarjas estão vindo altas (indica peça sensível) ou zero (usando pergunta genérica)
3. Se citações sinalizadas > 0 na conversa dele: mostrar o semáforo para ele — isso é o valor da ferramenta

---

## Bandeiras vermelhas (agir hoje)

1. **Pico de "Citações sinalizadas"** — algum advogado pode estar aceitando alucinações sem verificar
2. **Bloqueios por DLP > 0** (aparece no rodapé do card de custo) — significa que texto com CPF/cartão foi rejeitado pela política; ver o advogado e o log
3. **Uso concentrado em 1 pessoa (>60% do custo)** — ou é um caso grande, ou é alguém "brincando" com a ferramenta
4. **Tentativas de prompt injection** (no dlpFlags dos logs) — alguém tentou manipular a IA para revelar tarjas; investigar

---

## Como pedir mudança de política

Enviar para Thalita/Tutela:
- Aumentar limite de custo mensal
- Bloquear modelo X para determinada área
- Ativar `blockInjection` (hoje warn-only)
- Mudar orçamento por área

Enquanto não tem self-service, essas mudanças são via ticket. 24-48h para aplicar.

---

## O que o painel **não** mostra

- **Conteúdo das consultas** — o log é agregado, não guarda texto original. Isso é intencional (LGPD)
- **Nomes dos clientes tarjados** — nem o sócio vê. Só o advogado autor, no navegador dele, ao clicar "revelar"
- **Custo em tempo real** — dados atualizam a cada request, mas KPIs são batch. Delay ~ segundos
