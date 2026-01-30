# Guia de Reversão: Supabase para PocketBase 🔙

Se por algum motivo for necessário voltar para o PocketBase, siga este guia detalhado. Ele reverte todas as mudanças feitas na migração para o Supabase.

---

## 1. Preparação do Ambiente
Primeiro, é necessário restaurar a dependência do PocketBase no projeto.

```bash
npm install pocketbase
```

### Variáveis de Ambiente (`.env.local`)
Substitua as chaves do Supabase pela URL do seu servidor PocketBase:
```env
VITE_POCKETBASE_URL=https://sua-instancia-pocketbase.io
```

---

## 2. Estrutura de Coleções (PocketBase Admin)
No painel do PocketBase, você deve garantir que as seguintes coleções existam:

### Coleção: `users` (System)
- **Campos:** `username`, `email`, `name`, `avatar`, `loja` (text), `visibleLojas` (json/array), `role` (text).
- **Regras:** API Rules devem permitir leitura/escrita conforme o nível de acesso.

### Coleção: `audit_history`
- **Campos:**
  - `file_name` (text)
  - `report_type` (text)
  - `stats` (json)
  - `category_stats` (json)
  - `full_data` (json)
  - `custom_date` (date)
  - `loja` (text)
  - `user` (relation -> users)

---

## 3. Restaurando os Serviços Frontend

### Criar `services/pocketbase.ts`
```typescript
import PocketBase from 'pocketbase';
export const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL);
```

### Reverter `services/historyService.ts`
O código deve voltar a usar o SDK do `pb`:
```typescript
import { pb } from './pocketbase';

export const fetchHistory = async () => {
  return await pb.collection('audit_history').getFullList({
    sort: '-created_at',
  });
};
```

---

## 4. Revertendo Autenticação (`AuthScreen.tsx`)

Remova a tentativa dupla de login e as referências ao Supabase. O PocketBase usa autenticação por e-mail ou nome de usuário nativamente em uma única chamada:

```typescript
const { token, record } = await pb.collection('users')
  .authWithPassword(username, password);
```

---

## 5. Painel Admin e Senhas (`AdminPanel.tsx`)

No PocketBase, você não precisa de Edge Functions para gerenciar usuários se você for um administrador do PocketBase ou se as regras de coleção permitirem.

- **Criação:** Use `pb.collection('users').create(...)`.
- **Troca de Senha:** O PocketBase permite a troca direta via API se o usuário estiver autenticado ou se for um Admin.
- **Exclusão:** `pb.collection('users').delete(id)`.

---

## 6. Limpeza (Checklist)
1. [ ] Remover `@supabase/supabase-js`.
2. [ ] Deletar arquivos `services/supabase.ts` e a pasta `supabase/` (Edge Functions).
3. [ ] Limpar o `localStorage` do navegador para remover tokens antigos do Supabase.
4. [ ] Verificar em todo o código se ainda existem referências a `supabase.` e trocá-las por `pb.`.

---
**Documento Gerado por:** Antigravity AI
**Finalidade:** Plano de Contingência e Reversão
