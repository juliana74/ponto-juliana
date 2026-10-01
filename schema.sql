-- ====================================================================
-- ESQUEMA SQL - SISTEMA ELETRÔNICO DE PONTO E JUSTIFICATIVAS (KIOSK)
-- ====================================================================

-- Habilitar extensão pgcrypto para funções de hash (digest, hmac)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- --------------------------------------------------------------------
-- 1. TABELAS DO SISTEMA
-- --------------------------------------------------------------------

-- Tabela de Empresa
CREATE TABLE IF NOT EXISTS empresa (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(255) NOT NULL,
    cnpj VARCHAR(20) UNIQUE NOT NULL,
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Turnos de Trabalho
CREATE TABLE IF NOT EXISTS turnos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(100) NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fim TIME NOT NULL,
    tolerancia_minutos INT DEFAULT 10,
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Funcionários
CREATE TABLE IF NOT EXISTS funcionarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    matricula VARCHAR(50) UNIQUE NOT NULL,
    nome VARCHAR(255) NOT NULL,
    pin_hash VARCHAR(64) NOT NULL, -- SHA-256 em hexadecimal
    foto_facial_url TEXT,
    turno_id UUID REFERENCES turnos(id) ON DELETE SET NULL,
    ativo BOOLEAN DEFAULT TRUE,
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Justificativas e Atestados (Com Antifraude por Hash de Arquivo)
CREATE TABLE IF NOT EXISTS justificativas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    funcionario_id UUID NOT NULL REFERENCES funcionarios(id) ON DELETE CASCADE,
    data_inicio DATE NOT NULL,
    data_fim DATE NOT NULL,
    motivo TEXT NOT NULL,
    arquivo_nome VARCHAR(255) NOT NULL,
    arquivo_hash VARCHAR(64) UNIQUE NOT NULL, -- Hash SHA-256 do arquivo original
    status VARCHAR(30) DEFAULT 'APROVADO',
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Registros de Ponto (Entrada / Saída)
CREATE TABLE IF NOT EXISTS registros_ponto (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    funcionario_id UUID NOT NULL REFERENCES funcionarios(id) ON DELETE CASCADE,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('ENTRADA', 'SAIDA')),
    data_hora TIMESTAMPTZ DEFAULT NOW(),
    localizacao TEXT,
    foto_url TEXT,
    comprovante_hmac VARCHAR(12) NOT NULL,
    saldo_horas NUMERIC(5, 2) DEFAULT 0.00,
    observacao TEXT,
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- --------------------------------------------------------------------
-- 2. SEGURANÇA - ROW LEVEL SECURITY (RLS)
-- --------------------------------------------------------------------

ALTER TABLE empresa ENABLE ROW LEVEL SECURITY;
ALTER TABLE turnos ENABLE ROW LEVEL SECURITY;
ALTER TABLE funcionarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE justificativas ENABLE ROW LEVEL SECURITY;
ALTER TABLE registros_ponto ENABLE ROW LEVEL SECURITY;

-- Políticas de leitura pública/anon para o Kiosk operando sem login prévio (via RPC)
CREATE POLICY "Permitir leitura anonima de empresa" ON empresa FOR SELECT USING (true);
CREATE POLICY "Permitir leitura anonima de turnos" ON turnos FOR SELECT USING (true);
CREATE POLICY "Permitir leitura anonima de funcionarios" ON funcionarios FOR SELECT USING (ativo = true);
CREATE POLICY "Permitir insercao anonima de funcionarios" ON funcionarios FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir leitura de registros pelo anon" ON registros_ponto FOR SELECT USING (true);
CREATE POLICY "Permitir insercao de registros pelo anon" ON registros_ponto FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir leitura de justificativas" ON justificativas FOR SELECT USING (true);
CREATE POLICY "Permitir insercao de justificativas" ON justificativas FOR INSERT WITH CHECK (true);

-- --------------------------------------------------------------------
-- 3. PROCEDURES / RPCs DO SUPABASE
-- --------------------------------------------------------------------

-- RPC 0: Cadastrar Funcionário com Foto Facial
CREATE OR REPLACE FUNCTION cadastrar_funcionario(
    p_matricula TEXT,
    p_nome TEXT,
    p_pin TEXT,
    p_foto_facial_url TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_existente INT;
    v_pin_hash VARCHAR(64);
    v_func_id UUID;
BEGIN
    -- 1. Verificar duplicidade de matrícula
    SELECT COUNT(*) INTO v_existente
    FROM funcionarios
    WHERE matricula = p_matricula;

    IF v_existente > 0 THEN
        RETURN json_build_object('sucesso', false, 'codigo', 'MATRICULA_JA_EXISTE', 'mensagem', 'Esta matrícula já está cadastrada no sistema.');
    END IF;

    -- 2. Calcular SHA-256 do PIN
    v_pin_hash := encode(digest(p_pin, 'sha256'), 'hex');

    -- 3. Inserir funcionário
    INSERT INTO funcionarios (matricula, nome, pin_hash, foto_facial_url, ativo)
    VALUES (p_matricula, p_nome, v_pin_hash, p_foto_facial_url, TRUE)
    RETURNING id INTO v_func_id;

    RETURN json_build_object(
        'sucesso', true,
        'codigo', 'SUCESSO',
        'mensagem', 'Funcionário e foto facial cadastrados com sucesso!',
        'funcionario_id', v_func_id,
        'matricula', p_matricula,
        'nome', p_nome
    );
END;
$$;

-- RPC 1: Registrar Entrada
CREATE OR REPLACE FUNCTION registrar_entrada(
    p_matricula TEXT,
    p_pin TEXT,
    p_localizacao TEXT DEFAULT NULL,
    p_foto_url TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_func RECORD;
    v_pin_calculated_hash VARCHAR(64);
    v_atestado_existente INT;
    v_atrasado BOOLEAN := FALSE;
    v_hmac VARCHAR(12);
    v_registro_id UUID;
    v_data_hoje DATE := CURRENT_DATE;
    v_hora_atual TIME := CURRENT_TIME;
    v_turno RECORD;
    v_mensagem TEXT := 'Entrada registrada com sucesso!';
    v_status_code VARCHAR(30) := 'SUCESSO';
BEGIN
    -- 1. Buscar funcionário
    SELECT f.*, t.hora_inicio, t.hora_fim, t.tolerancia_minutos
    INTO v_func
    FROM funcionarios f
    LEFT JOIN turnos t ON f.turno_id = t.id
    WHERE f.matricula = p_matricula AND f.ativo = TRUE;

    IF v_func.id IS NULL THEN
        RETURN json_build_object('sucesso', false, 'codigo', 'MATRICULA_INVALIDA', 'mensagem', 'Matrícula não encontrada ou inativa.');
    END IF;

    -- 2. Validar Hash SHA-256 do PIN numérico
    v_pin_calculated_hash := encode(digest(p_pin, 'sha256'), 'hex');
    IF v_pin_calculated_hash != v_func.pin_hash THEN
        RETURN json_build_object('sucesso', false, 'codigo', 'PIN_INCORRETO', 'mensagem', 'PIN incorreto. Tente novamente.');
    END IF;

    -- 3. Verificar existência de atestado abonado na data atual
    SELECT COUNT(*) INTO v_atestado_existente
    FROM justificativas
    WHERE funcionario_id = v_func.id
      AND v_data_hoje BETWEEN data_inicio AND data_fim
      AND status = 'APROVADO';

    IF v_atestado_existente > 0 THEN
        v_status_code := 'ATESTADO_DETECTADO';
        v_mensagem := 'Aviso: Existe um atestado/justificativa registrado para o dia de hoje.';
    END IF;

    -- 4. Verificar atraso em relação ao turno (se houver turno configurado)
    IF v_func.hora_inicio IS NOT NULL THEN
        IF v_hora_atual > (v_func.hora_inicio + (v_func.tolerancia_minutos || ' minutes')::INTERVAL) THEN
            v_atrasado := TRUE;
            IF v_status_code != 'ATESTADO_DETECTADO' THEN
                v_status_code := 'ATRASO_DETECTADO';
                v_mensagem := 'Entrada registrada com atraso em relação ao turno.';
            END IF;
        END IF;
    END IF;

    -- 5. Gerar Hash HMAC SHA-256 reduzido a 12 caracteres
    v_hmac := UPPER(SUBSTRING(encode(hmac(p_matricula || NOW()::TEXT || 'ENTRADA', 'ponto_secret_key', 'sha256'), 'hex'), 1, 12));

    -- 6. Inserir registro de ponto
    INSERT INTO registros_ponto (funcionario_id, tipo, localizacao, foto_url, comprovante_hmac, observacao)
    VALUES (
        v_func.id,
        'ENTRADA',
        p_localizacao,
        p_foto_url,
        v_hmac,
        CASE WHEN v_atrasado THEN 'Entrada em atraso' ELSE 'Entrada normal' END
    )
    RETURNING id INTO v_registro_id;

    RETURN json_build_object(
        'sucesso', true,
        'codigo', v_status_code,
        'mensagem', v_mensagem,
        'funcionario_nome', v_func.nome,
        'matricula', v_func.matricula,
        'tipo', 'ENTRADA',
        'data_hora', NOW(),
        'comprovante_hmac', v_hmac
    );
END;
$$;

-- RPC 2: Registrar Saída
CREATE OR REPLACE FUNCTION registrar_saida(
    p_matricula TEXT,
    p_pin TEXT,
    p_localizacao TEXT DEFAULT NULL,
    p_foto_url TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_func RECORD;
    v_pin_calculated_hash VARCHAR(64);
    v_hmac VARCHAR(12);
    v_ultima_entrada TIMESTAMPTZ;
    v_horas_trabalhadas NUMERIC(5, 2) := 0.00;
    v_registro_id UUID;
BEGIN
    -- 1. Buscar funcionário
    SELECT f.*
    INTO v_func
    FROM funcionarios f
    WHERE f.matricula = p_matricula AND f.ativo = TRUE;

    IF v_func.id IS NULL THEN
        RETURN json_build_object('sucesso', false, 'codigo', 'MATRICULA_INVALIDA', 'mensagem', 'Matrícula não encontrada ou inativa.');
    END IF;

    -- 2. Validar PIN
    v_pin_calculated_hash := encode(digest(p_pin, 'sha256'), 'hex');
    IF v_pin_calculated_hash != v_func.pin_hash THEN
        RETURN json_build_object('sucesso', false, 'codigo', 'PIN_INCORRETO', 'mensagem', 'PIN incorreto. Tente novamente.');
    END IF;

    -- 3. Buscar a última entrada do dia para calcular o saldo de horas da jornada
    SELECT data_hora INTO v_ultima_entrada
    FROM registros_ponto
    WHERE funcionario_id = v_func.id AND tipo = 'ENTRADA'
    ORDER BY data_hora DESC
    LIMIT 1;

    IF v_ultima_entrada IS NOT NULL THEN
        v_horas_trabalhadas := ROUND(EXTRACT(EPOCH FROM (NOW() - v_ultima_entrada)) / 3600.0, 2);
    END IF;

    -- 4. Gerar Hash HMAC de 12 caracteres
    v_hmac := UPPER(SUBSTRING(encode(hmac(p_matricula || NOW()::TEXT || 'SAIDA', 'ponto_secret_key', 'sha256'), 'hex'), 1, 12));

    -- 5. Inserir registro de saída
    INSERT INTO registros_ponto (funcionario_id, tipo, localizacao, foto_url, comprovante_hmac, saldo_horas, observacao)
    VALUES (
        v_func.id,
        'SAIDA',
        p_localizacao,
        p_foto_url,
        v_hmac,
        v_horas_trabalhadas,
        'Saída registrada'
    )
    RETURNING id INTO v_registro_id;

    RETURN json_build_object(
        'sucesso', true,
        'codigo', 'SUCESSO',
        'mensagem', 'Saída registrada com sucesso!',
        'funcionario_nome', v_func.nome,
        'matricula', v_func.matricula,
        'tipo', 'SAIDA',
        'data_hora', NOW(),
        'horas_trabalhadas', v_horas_trabalhadas,
        'comprovante_hmac', v_hmac
    );
END;
$$;

-- RPC 3: Cadastrar Justificativa Antifraude
CREATE OR REPLACE FUNCTION cadastrar_justificativa_antifraude(
    p_matricula TEXT,
    p_pin TEXT,
    p_data_inicio DATE,
    p_data_fim DATE,
    p_motivo TEXT,
    p_arquivo_nome TEXT,
    p_arquivo_hash TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_func RECORD;
    v_pin_calculated_hash VARCHAR(64);
    v_hash_existente INT;
    v_justificativa_id UUID;
BEGIN
    -- 1. Buscar funcionário
    SELECT f.* INTO v_func
    FROM funcionarios f
    WHERE f.matricula = p_matricula AND f.ativo = TRUE;

    IF v_func.id IS NULL THEN
        RETURN json_build_object('sucesso', false, 'codigo', 'MATRICULA_INVALIDA', 'mensagem', 'Matrícula não encontrada ou inativa.');
    END IF;

    -- 2. Validar PIN
    v_pin_calculated_hash := encode(digest(p_pin, 'sha256'), 'hex');
    IF v_pin_calculated_hash != v_func.pin_hash THEN
        RETURN json_build_object('sucesso', false, 'codigo', 'PIN_INCORRETO', 'mensagem', 'PIN incorreto. Tente novamente.');
    END IF;

    -- 3. ANTIFRAUDE: Verificar se o Hash SHA-256 do arquivo já foi cadastrado no sistema
    SELECT COUNT(*) INTO v_hash_existente
    FROM justificativas
    WHERE arquivo_hash = p_arquivo_hash;

    IF v_hash_existente > 0 THEN
        RETURN json_build_object(
            'sucesso', false,
            'codigo', 'FRAUDE_HASH_DUPLICADO',
            'mensagem', 'ALERTA ANTIFRAUDE: Este arquivo de atestado já foi cadastrado anteriormente no sistema.'
        );
    END IF;

    -- 4. Registrar Justificativa
    INSERT INTO justificativas (
        funcionario_id,
        data_inicio,
        data_fim,
        motivo,
        arquivo_nome,
        arquivo_hash,
        status
    )
    VALUES (
        v_func.id,
        p_data_inicio,
        p_data_fim,
        p_motivo,
        p_arquivo_nome,
        p_arquivo_hash,
        'APROVADO'
    )
    RETURNING id INTO v_justificativa_id;

    RETURN json_build_object(
        'sucesso', true,
        'codigo', 'SUCESSO',
        'mensagem', 'Justificativa/Atestado cadastrado e validado com sucesso!',
        'funcionario_nome', v_func.nome,
        'justificativa_id', v_justificativa_id,
        'arquivo_hash', p_arquivo_hash
    );
END;
$$;

-- --------------------------------------------------------------------
-- 4. DADOS INICIAIS DE DEMONSTRAÇÃO (SEED)
-- --------------------------------------------------------------------

-- Inserir Empresa Exemplo
INSERT INTO empresa (id, nome, cnpj)
VALUES ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Empresa Kiosk Ponto LTDA', '12.345.678/0001-90')
ON CONFLICT DO NOTHING;

-- Inserir Turno Padrao (08:00 as 17:00, tolerância 10 min)
INSERT INTO turnos (id, nome, hora_inicio, hora_fim, tolerancia_minutos)
VALUES ('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'Comercial 08h às 17h', '08:00:00', '17:00:00', 10)
ON CONFLICT DO NOTHING;

-- Inserir Funcionários de Teste (PINs em SHA-256)
INSERT INTO funcionarios (matricula, nome, pin_hash, turno_id)
VALUES
    ('1001', 'Ana Silva', encode(digest('1234', 'sha256'), 'hex'), 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22'),
    ('1002', 'Carlos Oliveira', encode(digest('5678', 'sha256'), 'hex'), 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22')
ON CONFLICT (matricula) DO NOTHING;
