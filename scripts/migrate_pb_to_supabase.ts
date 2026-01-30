
import PocketBase from 'pocketbase';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const PB_URL = 'https://impossible-paris-witness-remember.trycloudflare.com';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // Requer chave de serviço para bypass RLS e gerir usuários

if (!SUPABASE_SERVICE_KEY) {
    console.error('❌ ERRO: SUPABASE_SERVICE_ROLE_KEY não encontrada no .env.local');
    console.log('Para migrar usuários do Auth, você precisa da "service_role" key do Supabase.');
    process.exit(1);
}

const pb = new PocketBase(PB_URL);
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function migrate() {
    console.log('🚀 Iniciando Migração Organizada...');

    try {
        // 1. Autenticar no PocketBase (Admin)
        await pb.admins.authWithPassword('marcoshp1@gmail.com', 'auditoriaMS138hp1');
        console.log('✅ Autenticado no PocketBase.');

        // 2. Buscar Usuários do PB
        console.log('📦 Buscando usuários e perfis do PB...');
        const pbUsers = await pb.collection('users').getFullList();
        const pbProfiles = await pb.collection('profiles').getFullList();

        // 3. Criar Usuários no Auth do Supabase e Perfis
        for (const pbUser of pbUsers) {
            console.log(`👤 Migrando usuário: ${pbUser.email}...`);

            // Verifica se usuário já existe no Supabase Auth por email
            const { data: existingUsers } = await supabase.auth.admin.listUsers();
            const supabaseUser = existingUsers?.users.find(u => u.email === pbUser.email);

            let userId = '';

            if (!supabaseUser) {
                // Criar no Auth (usamos senha padrão ou a mesma se possível, mas PB hash é diferente)
                // Vamos usar 'mudar123' como padrão para migrados se não soubermos a original
                const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
                    email: pbUser.email,
                    password: 'password123', // Senha temporária
                    email_confirm: true,
                    user_metadata: { username: pbUser.username }
                });

                if (createError) {
                    console.error(`❌ Erro ao criar auth para ${pbUser.email}:`, createError.message);
                    continue;
                }
                userId = newUser.user.id;
                console.log(`✅ Auth criado para ${pbUser.email}`);
            } else {
                userId = supabaseUser.id;
                console.log(`ℹ️ Usuário ${pbUser.email} já existe no Auth.`);
            }

            // Migrar Perfil
            const pbProfile = pbProfiles.find(p => p.user === pbUser.id);
            if (pbProfile) {
                const { error: profileError } = await supabase
                    .from('profiles')
                    .upsert({
                        id: userId,
                        username: pbProfile.username,
                        role: pbProfile.role,
                        loja: pbProfile.loja,
                        visible_lojas: pbProfile.visible_lojas ? pbProfile.visible_lojas.split(',').map((l: string) => l.trim()) : []
                    });

                if (profileError) console.error(`❌ Erro no perfil de ${pbUser.email}:`, profileError.message);
                else console.log(`✅ Perfil migrado para ${pbUser.email}`);
            }
        }

        // 4. Migrar Histórico
        console.log('📦 Migrando histórico de auditoria...');
        const pbHistory = await pb.collection('audit_history').getFullList();

        // Mapear IDs de usuários PB para Supabase para manter a relação
        const idMap: Record<string, string> = {};
        const { data: allSupabaseUsers } = await supabase.auth.admin.listUsers();
        for (const pbUser of pbUsers) {
            const sUser = allSupabaseUsers?.users.find(u => u.email === pbUser.email);
            if (sUser) idMap[pbUser.id] = sUser.id;
        }

        for (const item of pbHistory) {
            console.log(`📄 Migrando registro: ${item.fileName} (${item.created})...`);

            const { error: histError } = await supabase
                .from('audit_history')
                .insert({
                    created_at: item.created,
                    file_name: item.fileName,
                    report_type: item.reportType,
                    custom_date: item.customDate || null,
                    stats: item.stats,
                    data: item.data,
                    class_details: item.classDetails,
                    category_stats: item.categoryStats,
                    collaborator_stats: item.collaboratorStats,
                    loja: item.loja,
                    user_id: idMap[item.user] || null // Tenta manter a relação com o criador
                });

            if (histError) console.error(`❌ Erro ao migrar histórico ${item.id}:`, histError.message);
        }

        console.log('\n✨ MIGRACÃO CONCLUÍDA COM SUCESSO!');
        console.log('As senhas dos usuários foram definidas como: password123');

    } catch (err) {
        console.error('💥 ERRO FATAL NA MIGRAÇÃO:', err);
    }
}

migrate();
