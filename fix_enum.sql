-- Agregar ai_response al enum de message_enrichments.type
ALTER TYPE "message_enrichments_type_enum" ADD VALUE 'ai_response';

-- Si el tipo no existe como enum, crearlo
-- Esto es para PostgreSQL que maneja enums de forma diferente
