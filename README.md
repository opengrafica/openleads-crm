# OpenLeads CRM

Plataforma SaaS de prospecção e gestão de leads de empresas encontradas publicamente (Google Maps / Places).

## Stack

- React 19 + TypeScript
- Vite 8
- Tailwind CSS 4
- Supabase Auth + PostgreSQL
- React Router, Recharts, Lucide, SheetJS (XLSX)

## Funcionalidades

1. **Busca de empresas** — nome, categoria, cidade, estado, website, endereço, avaliação e quantidade de reviews
2. **Filtros por categoria** — restaurante, pizzaria, hamburgueria, gráfica, academia, clínica, salão, oficina, loja, outros
3. **CRM** — salvar lead, observações, status (Novo → Contatado → Interessado → Cliente → Perdido)
4. **Pipeline Kanban** — Novo Lead → Primeiro Contato → Demonstração → Proposta → Cliente
5. **Dashboard** — total de leads, leads por cidade, taxa de conversão, clientes fechados
6. **Exportação** — CSV, XLSX e JSON
7. **Tarefas** — agendar retorno, lembretes e follow-up
8. **Pesquisa global** — nome, categoria e cidade
9. **Painel Admin** — usuários, assinaturas e estatísticas
10. **Tema claro/escuro** + layout responsivo

## Estrutura

```
/src
  /components   # UI, layout, pesquisa global, rotas protegidas
  /pages        # Dashboard, Busca, CRM, Pipeline, Tarefas, Admin, Auth
  /services     # busca, leads, tasks, export, dashboard/admin
  /hooks        # auth, theme, leads, tasks
  /lib          # supabase, theme, demoStore, utils
  /types        # tipos e labels do domínio
/supabase
  /migrations   # migrations versionadas (CLI)
  schema.sql    # schema de referência para o SQL Editor
```

## Início rápido (modo demo)

Sem configurar Supabase, a aplicação roda com dados locais (localStorage):

```bash
npm install
npm run dev
```

Abra a URL do Vite e clique em **Demo usuário** ou **Demo admin**.

## Configurar Supabase

1. Crie um projeto no [Supabase](https://supabase.com).
2. Copie `.env.example` para `.env` e preencha:

```env
VITE_SUPABASE_URL=https://SEU_PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=sua_chave_anon_ou_publishable
VITE_GOOGLE_PLACES_API_KEY=  # opcional
```

3. Aplique o schema:

```bash
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase db push
```

Ou cole o conteúdo de `supabase/schema.sql` / `supabase/migrations/*_initial_schema.sql` no **SQL Editor**.

4. (Opcional) Torne um usuário admin no SQL:

```sql
update public.profiles
set role = 'admin'
where email = 'seu@email.com';
```

> O papel de admin fica em `profiles.role` (e pode ser espelhado em `app_metadata`), **nunca** em `user_metadata` editável pelo cliente.

## Autenticação

- Cadastro e login via Supabase Auth (`signUp` / `signInWithPassword`)
- Trigger `handle_new_user` cria `profiles` + assinatura `free` (trial 14 dias)
- RLS: cada usuário vê/edita apenas seus leads e tarefas; admins têm leitura ampla

## Busca de contatos reais (sem Google Maps API)

A busca usa **OpenStreetMap** (dados públicos) via endpoint local `/api/places/search` no Vite:

- Geocodifica a cidade (Nominatim)
- Consulta POIs reais (Overpass) com telefone/website quando existirem
- **Não exige** chave da Google Places/Maps API

A API oficial do Google Maps é paga e o scraping da interface do Google viola os termos de uso. O OSM entrega contatos reais utilizáveis no CRM.

Exemplo de teste: categoria **Pizzaria**, cidade **São Paulo**, estado **SP**.

## Scripts

| Comando        | Descrição              |
|----------------|------------------------|
| `npm run dev`  | Servidor de desenvolvimento |
| `npm run build`| Build de produção      |
| `npm run preview` | Preview do build    |

## Segurança (checklist)

- RLS ativo em `profiles`, `subscriptions`, `leads`, `tasks`
- Autorização por `profiles.role` / `is_admin()` (security definer)
- Não use `service_role` no frontend
- Exporte apenas leads do usuário autenticado

## Licença

Uso privado / interno do projeto OpenLeads.
