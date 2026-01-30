/**
 * Script para Exportar Dados do PocketBase atual para arquivos JSON
 * 
 * Como usar:
 * 1. Certifique-se de estar logado no terminal ou ter as credenciais de admin.
 * 2. Este script vai gerar arquivos .json para cada coleção.
 */

import PocketBase from 'pocketbase';
import fs from 'fs';

const PB_URL = 'http://152.67.62.41:8090'; // URL atual do seu .env
const pb = new PocketBase(PB_URL);

async function exportData() {
    console.log('🚀 Iniciando exportação de dados...');
    
    // Lista de coleções que precisamos migrar
    const collections = ['profiles', 'audit_history'];

    for (const colName of collections) {
        try {
            console.log(`📦 Exportando coleção: ${colName}...`);
            const records = await pb.collection(colName).getFullList({
                sort: '-created',
            });

            fs.writeFileSync(`${colName}_data.json`, JSON.stringify(records, null, 2));
            console.log(`✅ Coleção ${colName} exportada com sucesso! (${records.length} registros)`);
        } catch (err) {
            console.error(`❌ Erro ao exportar ${colName}:`, err);
        }
    }

    console.log('\n✨ Exportação concluída! Os arquivos .json foram gerados na pasta do projeto.');
    console.log('Agora você pode importar esses dados no novo banco.');
}

// exportData(); // Descomente para rodar se necessário
