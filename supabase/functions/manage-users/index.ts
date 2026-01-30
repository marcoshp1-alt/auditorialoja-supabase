import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    const { userId, newPassword, action } = await req.json();
    const authHeader = req.headers.get('Authorization')!;

    // 1. Criar cliente com a chave do usuário para verificar quem está chamando
    const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } }
    );

    // 2. Verificar se o usuário que chama é ADMIN
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) return new Response("Não autorizado", { status: 401, headers: { ...corsHeaders, "Content-Type": "text/plain" } });

    const { data: profile, error: profileError } = await supabaseClient
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    if (profileError || profile?.role !== 'admin') {
        return new Response("Apenas administradores podem realizar esta ação", {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "text/plain" }
        });
    }

    // 3. Se for ADMIN, usar a SERVICE ROLE para realizar a alteração
    const adminSupabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    if (action === 'update_password') {
        const { error: updateError } = await adminSupabase.auth.admin.updateUserById(
            userId,
            { password: newPassword }
        );

        if (updateError) return new Response(JSON.stringify({ error: updateError.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

        return new Response(JSON.stringify({ message: "Senha atualizada com sucesso" }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }

    return new Response("Ação inválida", {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "text/plain" }
    });
});
