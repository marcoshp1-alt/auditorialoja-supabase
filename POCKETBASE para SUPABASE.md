# Guia de Migração: PocketBase para Supabase 🚀

Este documento consolida todo o conhecimento técnico acumulado durante a migração. Ele detalha os "buracos" encontrados e as soluções definitivas para que futuras migrações sejam 100% assertivas.

---

## 1. Arquitetura de Usuários (O Maior Desafio)

Diferente do PocketBase, o Supabase exige um e-mail para cada usuário. Durante a migração, surgiu um conflito de "Sufixos" de e-mail que impedia o login.

### 📧 O Conflito de Domínios
- **Usuários Migrados (Legados):** Foram importados do PocketBase com o domínio `USUARIO@sistema.local`.
- **Novos Usuários (Dashboard):** A Edge Function de criação foi configurada para criar como `USUARIO@auditoria.com`.
- **O Problema:** Um usuário criado com `@auditoria.com` não conseguia logar se o frontend tentasse apenas `@sistema.local`.

### 💡 Solução: Login com Fallback Inteligente
No arquivo `AuthScreen.tsx`, implementamos uma lógica de tentativa dupla:
```typescript
const tryLogin = async (identity: string) => {
  return await supabase.auth.signInWithPassword({
    email: identity,
    password: password,
  });
};

// 1. Tenta padrão novo (auditoria.com)
let { error: authErr } = await tryLogin(`${cleanUsername}@auditoria.com`);

// 2. Se falhar por erro de credenciais (400), tenta o padrão antigo (sistema.local)
if (authErr && authErr.status === 400) {
  authErr = await tryLogin(`${cleanUsername}@sistema.local`);
}
```

---

## 2. Segurança RLS: Evitando o "Loop Infinito"

**Erro Crítico:** `infinite recursion detected in policy`.
**Causa:** Ao criar uma política para a tabela `profiles` que consulta a própria tabela `profiles` (ex: `WHERE (SELECT role FROM profiles ...) = 'admin'`), o banco de dados entra em loop infinito.

### 🔑 A Solução: SECURITY DEFINER
Criar uma função que roda com permissões de sistema para checar o cargo sem acionar a política recursivamente.

```sql
-- 1. Criar a função auxiliar
CREATE OR REPLACE FUNCTION public.check_is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN (
    SELECT (role = 'admin')
    FROM public.profiles
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Usar a função nas políticas
CREATE POLICY "Profiles: Visualização" ON public.profiles 
FOR SELECT USING (auth.uid() = id OR public.check_is_admin());
```

---

## 3. Gestão Administrativa via Edge Function

Admins **não podem** deletar outros usuários ou criar contas com e-mail já confirmado diretamente pelo navegador (SDK cliente). Criamos a função `manage-users` usando a `SERVICE_ROLE_KEY`.

### Ações Cruciais:
- **`create_user`**: Usa `admin.createUser({ email_confirm: true })`. Isso evita que o novo usuário tenha que abrir o e-mail para confirmar a conta antes de logar.
- **`update_password`**: Usa `admin.updateUserById`. Permite que o Admin troque a senha de qualquer funcionário sem saber a senha antiga.
- **`delete_user`**: Deleta o registro do Auth (que por Cascade remove o Profile).

---

## 4. Estrutura de Tabelas e Segurança (SQL Completo)

Para replicar o banco exatamente como está agora, execute este script no **SQL Editor** do Supabase:

```sql
-- ==========================================
-- 1. TABELAS BASE
-- ==========================================

-- Perfis de Usuário
CREATE TABLE public.profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  username text UNIQUE NOT NULL,
  role text DEFAULT 'user' CHECK (role IN ('admin', 'user', 'viewer')),
  loja text,
  visible_lojas text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Histórico de Auditoria
CREATE TABLE public.audit_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  file_name text NOT NULL,
  report_type text NOT NULL,
  stats jsonb NOT NULL,
  category_stats jsonb,
  full_data jsonb,
  custom_date timestamptz,
  loja text NOT NULL,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE
);

-- ==========================================
-- 2. ÍNDICES (Performance)
-- ==========================================
CREATE INDEX idx_audit_history_loja ON public.audit_history(loja);
CREATE INDEX idx_audit_history_user_id ON public.audit_history(user_id);
CREATE INDEX idx_audit_history_created_at ON public.audit_history(created_at);

-- ==========================================
-- 3. FUNÇÕES DE SEGURANÇA (Anti-Recursão)
-- ==========================================
CREATE OR REPLACE FUNCTION public.check_is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN (SELECT (role = 'admin') FROM public.profiles WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 4. POLÍTICAS RLS (Row Level Security)
-- ==========================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_history ENABLE ROW LEVEL SECURITY;

-- Políticas de Profiles
CREATE POLICY "Profiles: Visualização" ON public.profiles FOR SELECT USING (auth.uid() = id OR public.check_is_admin());
CREATE POLICY "Profiles: Inserção Admin" ON public.profiles FOR INSERT WITH CHECK (public.check_is_admin());
CREATE POLICY "Profiles: Atualização" ON public.profiles FOR UPDATE USING (auth.uid() = id OR public.check_is_admin());
CREATE POLICY "Profiles: Deleção Admin" ON public.profiles FOR DELETE USING (public.check_is_admin());

-- Políticas de Audit History
CREATE POLICY "Audit History: Visualização" ON public.audit_history FOR SELECT USING (
  public.check_is_admin() OR 
  loja = (SELECT loja FROM public.profiles WHERE id = auth.uid()) OR
  loja = ANY (SELECT unnest(visible_lojas) FROM public.profiles WHERE id = auth.uid())
);
CREATE POLICY "Audit History: Modificação" ON public.audit_history FOR ALL USING (
  public.check_is_admin() OR 
  user_id = auth.uid()
);
```

---

## 5. Alerta de "Imports Fantasmas" (Zombie Imports)

Após deletar o PocketBase, o sistema pode travar em tela branca se houver qualquer import esquecido.
**Exemplo Real:** `PasswordChangeModal.tsx` continuava tentando importar `pb` do service antigo, causando erro 404 e travando o carregamento do Dashboard.

**Checklist de Limpeza:**
- [x] Remover `pocketbase` do `package.json`.
- [x] Deletar `services/pocketbase.ts`.
- [x] Rodar `grep -r "pocketbase" .` no projeto todo.

---

## 6. O que mudou no código (Resumo)
1. **Services:** `historyService.ts` agora usa chamadas `.from('audit_history')`.
2. **Types:** Adaptados para os tipos do Supabase (UUIDs).
3. **Auth:** `App.tsx` agora usa o listener `supabase.auth.onAuthStateChange`.

---
**Documento Gerado por:** Antigravity AI
**Finalidade:** Blueprint de Migração Assertiva
