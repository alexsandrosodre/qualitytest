-- Imutabilidade da trilha de auditoria.
--
-- Requisito: os registros de auditoria (`audit_logs`) são SOMENTE INSERÇÃO. A
-- aplicação nunca os atualiza/exclui, mas a garantia também é reforçada no
-- banco para impedir alterações por acesso direto (SQL/operacional).
--
-- Um trigger bloqueia UPDATE, DELETE e TRUNCATE na tabela `audit_logs`.

CREATE OR REPLACE FUNCTION qualitytest_block_audit_mutation()
RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'audit_logs eh imutavel: operacao % nao e permitida', TG_OP
        USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_no_update_delete
    BEFORE UPDATE OR DELETE ON "audit_logs"
    FOR EACH ROW
    EXECUTE FUNCTION qualitytest_block_audit_mutation();

CREATE TRIGGER audit_logs_no_truncate
    BEFORE TRUNCATE ON "audit_logs"
    FOR EACH STATEMENT
    EXECUTE FUNCTION qualitytest_block_audit_mutation();
