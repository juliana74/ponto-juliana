# Backlog do Projeto - Kiosk Ponto Eletrônico

## [Concluído]
- [x] Elaboração do documento de SPEC principal em Markdown (`SPEC.md`).
- [x] Criação do arquivo de esquema SQL (`schema.sql`) otimizado para Supabase.
- [x] Task 1: Estruturar a base do projeto HTML5/CSS3 sem frameworks (`index.html`, `css/styles.css`).
- [x] Task 2: Implementar módulo de comunicação com Supabase (`js/supabaseClient.js`, `js/kioskService.js`, `js/utils.js`).
- [x] Task 3: Implementar interface interativa de Ponto (`js/app.js` com PinPad Virtual, relógio e modais).
- [x] Task 4: Implementar Módulo Antifraude de Atestados e Suíte de Testes (`tests/kioskService.test.js`).
- [x] Task 5: Testes de Integração e Verificação Visual Playwright.

## [Em Andamento]

## [Planejado]

## [Ajustes/Bugs Resolvidos]
- [x] Ajustado o fallback mock para garantir geração de HMAC de exatamente 12 caracteres.
- [x] Adicionado tratamento condicional para verificação de existência de `supabaseClient`.
