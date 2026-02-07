-- Migração Manual: Adicionar tipo_motorista e tornar empresa_id opcional
-- Executar no Neon Console: https://console.neon.tech

-- 1. Criar o tipo ENUM TipoMotorista
DO $$ BEGIN
    CREATE TYPE "TipoMotorista" AS ENUM ('VINCULADO', 'AUTONOMO', 'AUTONOMO_PARCEIRO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Adicionar coluna tipo_motorista com valor default VINCULADO
ALTER TABLE "motoristas" 
ADD COLUMN IF NOT EXISTS "tipo_motorista" "TipoMotorista" NOT NULL DEFAULT 'VINCULADO';

-- 3. Tornar empresa_id opcional (permitir NULL)
ALTER TABLE "motoristas" 
ALTER COLUMN "empresa_id" DROP NOT NULL;

-- 4. Criar índice para tipo_motorista
CREATE INDEX IF NOT EXISTS "motoristas_tipo_motorista_idx" ON "motoristas"("tipo_motorista");

-- 5. Verificar estrutura
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'motoristas' 
AND column_name IN ('empresa_id', 'tipo_motorista');
