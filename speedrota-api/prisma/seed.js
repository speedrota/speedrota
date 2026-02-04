/**
 * @fileoverview Seed do banco de dados
 * Criar dados iniciais para desenvolvimento
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
const prisma = new PrismaClient();
async function main() {
    console.log('🌱 Iniciando seed do banco...');
    // Criar usuário de teste
    const passwordHash = await bcrypt.hash('123456', 10);
    const userFree = await prisma.user.upsert({
        where: { email: 'free@speedrota.com' },
        update: {},
        create: {
            email: 'free@speedrota.com',
            passwordHash,
            nome: 'Usuário Free',
            telefone: '11999999999',
            plano: 'FREE',
        },
    });
    const userPro = await prisma.user.upsert({
        where: { email: 'pro@speedrota.com' },
        update: {},
        create: {
            email: 'pro@speedrota.com',
            passwordHash,
            nome: 'Usuário Pro',
            telefone: '11888888888',
            plano: 'PRO',
        },
    });
    const userFull = await prisma.user.upsert({
        where: { email: 'full@speedrota.com' },
        update: {},
        create: {
            email: 'full@speedrota.com',
            passwordHash,
            nome: 'Usuário Full',
            telefone: '11777777777',
            plano: 'FULL',
        },
    });
    console.log('✅ Usuários criados:');
    console.log(`   - ${userFree.email} (FREE) - senha: 123456`);
    console.log(`   - ${userPro.email} (PRO) - senha: 123456`);
    console.log(`   - ${userFull.email} (FULL) - senha: 123456`);
    // Criar rota de exemplo para o usuário Free
    const rota = await prisma.rota.create({
        data: {
            userId: userFree.id,
            origemLat: -23.5505,
            origemLng: -46.6333,
            origemEndereco: 'Praça da Sé, São Paulo - SP',
            origemFonte: 'manual',
            status: 'RASCUNHO',
        },
    });
    // Adicionar paradas
    await prisma.parada.createMany({
        data: [
            {
                rotaId: rota.id,
                lat: -23.5614,
                lng: -46.6558,
                endereco: 'Av. Paulista, 1000',
                cidade: 'São Paulo',
                uf: 'SP',
                cep: '01310-100',
                nome: 'Cliente 1',
                fornecedor: 'natura',
                fonte: 'manual',
                confianca: 1,
            },
            {
                rotaId: rota.id,
                lat: -23.5431,
                lng: -46.6291,
                endereco: 'R. Augusta, 500',
                cidade: 'São Paulo',
                uf: 'SP',
                cep: '01304-000',
                nome: 'Cliente 2',
                fornecedor: 'mercadolivre',
                fonte: 'manual',
                confianca: 1,
            },
            {
                rotaId: rota.id,
                lat: -23.5891,
                lng: -46.6620,
                endereco: 'Av. Brigadeiro Luís Antônio, 2000',
                cidade: 'São Paulo',
                uf: 'SP',
                cep: '01402-000',
                nome: 'Cliente 3',
                fornecedor: 'shopee',
                fonte: 'manual',
                confianca: 1,
            },
        ],
    });
    console.log(`✅ Rota de exemplo criada com 3 paradas`);
    // Configurações do sistema (um por um para SQLite)
    const configs = [
        { chave: 'VELOCIDADE_URBANA_KMH', valor: '30', descricao: 'Velocidade média urbana em km/h' },
        { chave: 'CONSUMO_MEDIO_KML', valor: '10', descricao: 'Consumo médio em km/l' },
        { chave: 'PRECO_COMBUSTIVEL', valor: '5.89', descricao: 'Preço do combustível em R$' },
        { chave: 'TEMPO_POR_ENTREGA_MIN', valor: '5', descricao: 'Tempo médio por entrega em minutos' },
        { chave: 'FATOR_CORRECAO_URBANA', valor: '1.4', descricao: 'Fator de correção para distâncias urbanas' },
    ];
    for (const config of configs) {
        await prisma.configuracaoSistema.upsert({
            where: { chave: config.chave },
            update: { valor: config.valor, descricao: config.descricao },
            create: config,
        });
    }
    console.log('✅ Configurações do sistema criadas');
    console.log('\n🎉 Seed concluído com sucesso!');
}
main()
    .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed.js.map