# SPEC - SISTEMA ELETRÔNICO DE PONTO E JUSTIFICATIVAS (KIOSK PONTO)

## 1. Visão Geral do Projeto e Análise de Viabilidade

### 1.1 Avaliação de Viabilidade Técnica e Operacional
* **Status de Confiança:** **ALTA CONFIANÇA (VIÁVEL)**
* **Justificativa:** O projeto apresenta uma arquitetura enxuta e desacoplada. Toda a lógica crítica de negócios (autenticação por PIN/hash SHA256, cálculo de jornada, validação antifraude via hash de arquivo e verificação HMAC de comprovante) foi delegada diretamente ao banco de dados Supabase via rotas RPC/PLSQL. A interface web atua exclusivamente como uma camada cliente intuitiva para Tablets/Desktops, consumindo a API REST nativa do Supabase via CDNs leves, eliminando a necessidade de complexas dependências de build ou frameworks compilados.

---

## 2. Stack Tecnológica e Bibliotecas Recomendadas

Para garantir **mínimo footprint de código, zero complexidade de build (Node/Webpack) e drástica redução de erros em tempo de execução**, a aplicação deve utilizar bibliotecas consolidadas via CDN HTML.

### 2.1 Componentes Principais
* **Agente de IA Dev:** Google Jules (Execução autônoma, divisão de tasks e manutenção do `backlog.md`).
* **Hospedagem & Repositório:** GitHub / GitHub Pages (Hospedagem estática direta).
* **Backend & Banco de Dados:** Supabase (PostgreSQL, Auth via RPC, Storage e Realtime).
* **Linguagens Base:** HTML5, CSS3 NATIVO, JavaScript Vanilla (ES6+ Asynchronous/Modules).

### 2.2 Bibliotecas Auxiliares Recomendadas (CDN via Script/Link)
1. **`@supabase/supabase-js` (v2.x)**
   * *Finalidade:* Cliente oficial leve para comunicação HTTP/RPC assíncrona com o Supabase.
   * *Benefício:* Evita escrita de requisições `fetch` manuais, previne erros de CORS e gerencia conexões e tratamentos de erro nativamente.
2. **`Lucide Icons` (`lucide.js` / CDN)**
   * *Finalidade:* Biblioteca de ícones SVG limpos e vetoriais.
   * *Benefício:* Elimina a necessidade de emojis, garante interface corporativa e padronizada para telas HD/Tablet.
3. **`CryptoJS` / Web Crypto API Native**
   * *Finalidade:* Cálculo do Hash SHA256 do arquivo de atestado direto no cliente antes do upload.
   * *Benefício:* Garante que a validação antifraude do hash ocorra antes mesmo do envio da requisição pesada para o servidor.
4. **`Canvas-Confetti` ou `SweetAlert2` (Custom CSS)**
   * *Finalidade:* Feedback visual e alertas modais profissionais sem esforço de UI manual.

---

## 3. Diretrizes de UI / UX (Interface e Experiência do Usuário)

* **Dispositivos Alvo:** Exclusivo para telas médias e grandes (**Tablets e Desktops**, resolução mínima 1024x768px).
* **Estética:** Design Clean, Minimalista, Fundo Branco Puro (`#FFFFFF`) e Tonalidades de Cinza Suave (`#F8F9FA` a `#1A1D20`).
* **Ícones:** Uso estrito da biblioteca **Lucide Icons** (`lucide-icon`). **PROIBIDO USO DE EMOJIS**.
* **APIs Nativas do Navegador:**
  * **Câmera:** Utilizada via `navigator.mediaDevices.getUserMedia` para validação/foto no momento do ponto (se configurado).
  * **Geolocalização:** Utilizada via `navigator.geolocation.getCurrentPosition` apenas para registrar as coordenadas do dispositivo no payload do ponto.
* **Componentes Chave da Interface:**
  1. *Header:* Nome da Empresa, Relógio Digital em tempo real (segundos) e Status de Conexão.
  2. *Teclado Numérico Virtual (PinPad):* Para digitação rápida da Matrícula e PIN via touch no Tablet.
  3. *Ações de Entrada / Saída:* Botões de ação direta com feedback imediato (Sucesso / Erro / Atraso / Atestado Detectado).
  4. *Modal de Envio de Justificativa/Atestado:* Formulário para upload de PDF/Imagem com cálculo do SHA256 em tempo real.
  5. *Comprovante Digital:* Exibição do Ticket de Confirmação com Hash HMAC de 12 caracteres.

---

## 4. Instruções Obrigatórias para Agentes de IA (Google Jules)

1. **Parar em Caso de Dúvida:** Não assuma comportamentos não documentados ou ambiguidades nas regras de negócio. Interrompa e solicite esclarecimentos.
2. **Decomposição em Tarefas e Subtarefas:** Toda implementação extensa deve ser dividida em passos granulares antes do início do código.
3. **Registro de Progresso (`backlog.md`):** É **OBRIGATÓRIO** criar e manter atualizado o arquivo `backlog.md` na raiz do repositório, contendo as colunas/seções: `[Planejado]`, `[Em Andamento]`, `[Concluído]` e `[Ajustes/Bugs Resolvidos]`.
4. **Respeito ao Esquema SQL:** Toda chamada ao Supabase para registro de ponto e justificativas deve utilizar as funções RPC criadas (`registrar_entrada`, `registrar_saida`, `cadastrar_justificativa_antifraude`).

---

## 5. Estrutura de Arquivos do Projeto

```text
/
├── index.html                  # Interface Principal do Kiosk de Ponto (Tablet/Desktop)
├── css/
│   └── styles.css              # Estilização limpa, responsiva (fundo branco, layout tablet)
├── js/
│   ├── supabaseClient.js       # Inicialização e configuração da CDN do Supabase
│   ├── app.js                  # Lógica de controle de UI, teclado virtual e relógio
│   ├── kioskService.js         # Chamadas de API Supabase (RPCs e Consultas)
│   └── utils.js                # Helpers para SHA256 de arquivo e validação de input
├── schema.sql                  # Esquema SQL do Supabase (Tabelas, RPCs, RLS)
├── SPEC.md                     # Esta especificação técnica
└── backlog.md                  # Registro dinâmico de tarefas do projeto
```

---

## 6. Fluxos de Funcionamento e Regras de Negócio

### Fluxo 1: Registro de Ponto (Entrada / Saída)
1. Colaborador insere **Matrícula** e **PIN numérico** no PinPad virtual da tela.
2. O sistema chama `registrar_entrada(p_matricula, p_pin)` ou `registrar_saida(p_matricula, p_pin)`.
3. O Supabase valida o Hash SHA256 do PIN e verifica a existência de atestados abonados ou atrasos configurados no turno.
4. Ao registrar a saída, o banco calcula o saldo do banco de horas e gera um **Hash HMAC SHA256 resumido (12 dígitos)**.
5. O Kiosk exibe a tela de confirmação com o Ticket contendo o Hash para o colaborador tirar foto/comprovante.

### Fluxo 2: Cadastro Antifraude de Atestados / Justificativas
1. O colaborador seleciona "Enviar Atestado / Justificativa".
2. Seleciona o arquivo PDF ou Imagem do Atestado.
3. O JavaScript calcula o **Hash SHA256 do arquivo fisicamente no navegador**.
4. O sistema chama a função RPC `cadastrar_justificativa_antifraude(...)`.
5. Se o Hash do arquivo já existir na tabela `justificativas`, a RPC **rejeita a operação por FRAUDE**.
6. Se aprovado, o atestado abona automaticamente todos os registros pendentes do colaborador durante o período de vigência.

---

## 7. Esquema SQL e Banco de Dados (Referência de Conexão)

O esquema SQL completo para o Supabase foi gerado separadamente no arquivo `schema.sql`. Ele inclui:
* Extensão `pgcrypto` para hashing e segurança.
* Tabela `empresa`, `turnos`, `funcionarios`, `justificativas` e `registros_ponto`.
* Regras de Nível de Linha (Row Level Security - RLS).
* Funções Stored Procedures (RPC): `registrar_entrada`, `registrar_saida` e `cadastrar_justificativa_antifraude`.

---

## 8. Plano de Tarefas Inicial para Agente de IA (`backlog.md`)

```markdown
# Backlog do Projeto - Kiosk Ponto Eletrônico

## [Concluído]
- [x] Elaboração do documento de SPEC principal em Markdown.
- [x] Criação do arquivo de esquema SQL (`schema.sql`) otimizado para Supabase.

## [Planejado]
- [ ] Task 1: Estruturar a base do projeto HTML5/CSS3 sem frameworks.
  - [ ] Subtask 1.1: Criar `index.html` com layout exclusivo para tablet/desktop.
  - [ ] Subtask 1.2: Importar CDN do `@supabase/supabase-js` e `Lucide Icons`.
  - [ ] Subtask 1.3: Criar `css/styles.css` focando em fundo branco e estilo corporativo clean.
- [ ] Task 2: Implementar módulo de comunicação com Supabase (`js/supabaseClient.js` e `js/kioskService.js`).
  - [ ] Subtask 2.1: Criar cliente Supabase configurável por variáveis/constantes.
  - [ ] Subtask 2.2: Criar wrappers JS para executar `registrar_entrada`, `registrar_saida` e `cadastrar_justificativa_antifraude`.
- [ ] Task 3: Implementar interface interativa de Ponto (PinPad Virtual & Relógio).
  - [ ] Subtask 3.1: Criar componente de teclado numérico na tela para Matrícula/PIN.
  - [ ] Subtask 3.2: Exibir relógio digital em tempo real com segundos e data.
  - [ ] Subtask 3.3: Integrar botões de ação com a API Supabase.
- [ ] Task 4: Implementar Módulo Antifraude de Atestados.
  - [ ] Subtask 4.1: Criar modal de upload de arquivo no `index.html`.
  - [ ] Subtask 4.2: Criar função em `js/utils.js` para gerar hash SHA256 do arquivo antes do envio.
  - [ ] Subtask 4.3: Conectar envio com a RPC de justificativas e tratar retornos de fraude.
- [ ] Task 5: Testes de Integração e Deploy no GitHub Pages.
  - [ ] Subtask 5.1: Executar testes de ponta a ponta de registro de ponto e envio duplicado de atestados.
  - [ ] Subtask 5.2: Publicar aplicação no GitHub Pages.
```
