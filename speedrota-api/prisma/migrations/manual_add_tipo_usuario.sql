-- Migração Manual: Adicionar campo tipo_usuario na tabela users
-- Executar diretamente no Neon Console

-- 1. Criar o tipo ENUM TipoUsuario
CREATE TYPE "TipoUsuario" AS ENUM ('ENTREGADOR', 'GESTOR_FROTA');

-- 2. Adicionar a coluna tipo_usuario com valor default ENTREGADOR
ALTER TABLE "users" ADD COLUMN "tipo_usuario" "TipoUsuario" NOT NULL DEFAULT 'ENTREGADOR';

-- 3. Atualizar a Ellen para GESTOR_FROTA com plano FROTA_ENTERPRISE
UPDATE "users" 
SET "tipo_usuario" = 'GESTOR_FROTA', 
    "plano" = 'FROTA_ENTERPRISE'
WHERE email = 'ellen.tesser81@gmail.com';

-- 4. Verificar se deu certo
SELECT id, email, nome, plano, tipo_usuario FROM "users" WHERE email = 'ellen.tesser81@gmail.com';
