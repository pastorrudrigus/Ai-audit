# Tutela — Guia do Advogado

Primeiro dia com a ferramenta. Leia uma vez, depois use como referência.

---

## O que o Tutela faz e não faz

**Faz**
- Chat com IA (ChatGPT, Claude) para redigir peças, resumir contratos, responder consultas jurídicas
- **Anonimiza** nomes, CPF, CNPJ, número de processo e OAB antes de sair para o modelo
- **Verifica** se as jurisprudências e leis citadas na resposta existem de verdade (semáforo verde / amarelo / vermelho)
- Aceita anexos: **PDF, DOCX, planilha (XLSX/CSV), TXT**

**Não faz**
- Não substitui o seu parecer — a IA erra, você confere
- Não faz OCR: PDF escaneado como imagem falha com aviso claro
- Não guarda o conteúdo original em log — só o que foi tarjado

---

## Fluxo básico

### 1. Abrir uma nova consulta
Acesse `<url-da-banca>/chat`, login com email/senha da Clerk (Thalita convida por email no D-0).

### 2. Escrever a consulta ou anexar
No campo de texto:
- **Cole a peça** ou digite a pergunta
- Ou clique no **clipe (📎)** para anexar até 10 MB de PDF/DOCX/XLSX/TXT
- Pode combinar: anexo + pergunta ("resuma este contrato e me diga o risco da cláusula 5")

### 3. Enviar e ler a resposta

Ao apertar Enviar você vai ver:
- Sua mensagem com **tarjas em amarelo** (⟨PESSOA_1⟩, ⟨CPF_2⟩, ⟨PROCESSO_1⟩...) — isso é o que foi enviado ao modelo, **sem** os dados originais
- A resposta do assistente
- Um badge "**N dados tarjados**" indicando quantos foram protegidos

### 4. Revelar as tarjas (opcional)
Se você quer ver a resposta com nomes reais no lugar dos tokens, clique em **"Revelar tarjas"**. A restauração acontece **no seu navegador** — a resposta com valor original nunca fica no log do servidor.

### 5. Verificar citações
Antes de protocolar/enviar para cliente, clique em **"Verificar antes do protocolo"**:
- 🟢 **Verde**: citação confirmada em fonte oficial
- 🟡 **Amarelo**: encontrou algo divergente (número existe mas o teor não bate)
- 🔴 **Vermelho**: não encontrada — provavelmente **alucinação do modelo**, não use

### 6. Baixar anexo original
Clique no chip do anexo em qualquer mensagem antiga — baixa o PDF/planilha original que você subiu.

---

## Boas práticas

- **Anexe em vez de colar** quando o texto é longo (> 3 páginas) — a interface fica mais limpa e o histórico melhor
- **Sempre verifique citações** antes de citar em juízo — a IA às vezes inventa números de processo plausíveis mas inexistentes
- **Use nomes reais no texto** — o Tutela tarja automaticamente. Escrever "cliente" em vez do nome só piora a resposta
- Se o CPF do cliente aparecer **na resposta do modelo**, ele veio decifrado localmente no seu navegador — não está sendo enviado a lugar nenhum

## Se der problema

- Erro na tela: manda print para Thalita, ela nos aciona
- Anexo "falhou": provavelmente é PDF escaneado — abra o arquivo, faça um "salvar como PDF" pelo próprio leitor (força re-render) e tente de novo
- Resposta parece errada: **não confie**, refaça a pergunta ou peça a citação para verificar

---

## FAQ rápido

**Meus dados vão para a OpenAI/Anthropic?**
Sim, mas com **tarjas**. Nome de cliente vira `⟨PESSOA_1⟩`, CPF vira `⟨CPF_1⟩` etc. Nem OpenAI nem Anthropic veem o valor original. Você vê no seu navegador ao clicar "revelar".

**Posso usar para dados criminais / sigilo profissional?**
Fale com Thalita antes. Tecnicamente o Tutela tarja, mas a sócia é quem decide o que a política interna da banca permite.

**Quanto está custando?**
No painel do sócio, KPI "Custo por IA no período". Todo consumo é rateado por área e por advogado.
