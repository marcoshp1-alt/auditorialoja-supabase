# Status do Projeto: Auditoria Loja (PocketBase)

> **Este arquivo funciona como a memória persistente do Agente.**
> Atualize este arquivo ao finalizar grandes tarefas para que o próximo chat saiba exatamente onde paramos.

## 🎯 Objetivo Principal
Atualizar o sistema de auditoria para o novo modelo Mobile e ajustar funcionalidades mensais usando PocketBase como backend.

## 📅 Estado Atual (Última Atualização: Hoje)
- **Fase**: Deploy em Novo Repositório Concluído
- **Backend**: Supabase (Integrado)
- **Frontend**: React + Vite (Configurado para Supabase)
- **GitHub**: [auditorialoja-supabase](https://github.com/marcoshp1-alt/auditorialoja-supabase.git)

## 🚀 Em Progresso
- [x] Migrar backend de PocketBase para Supabase
- [x] Configurar esquema SQL no Supabase
- [x] Atualizar serviços frontend para Supabase-js
- [x] Implementar Edge Function `manage-users` para reset de senhas administrativo
- [x] Implementar suporte a domínios de login legados e novos no `AuthScreen.tsx`
- [x] Refinar e aplicar políticas de segurança RLS granulares para produção

## ✅ Histórico Recente (Recuperado)
- Configuração do ambiente local (`npm run dev` funcionando).
- Configuração do Agente (`.agent/rules/GEMINI.md` atualizado para PT-BR).
- Criação e movimentação do `PROJECT_STATUS.md` para a raiz.
- Ajuste nas regras para criar/ler `PROJECT_STATUS.md` na raiz se não existir.
- Implementação de exibição de data/hora no `WeeklySummary.tsx`.

## 📝 Próximos Passos Sugeridos
1. Instalar dependências e rodar o script de migração (Requer `SUPABASE_SERVICE_ROLE_KEY`).
2. Validar login e histórico com dados reais.
3. Remover código e dependências legadas do PocketBase após validação.
4. Ajustar permissões RLS finas se necessário.

---
**Obs**: Sempre que o Agente finalizar uma tarefa, peça: *"Atualize o status do projeto"* para manter este arquivo em dia.
