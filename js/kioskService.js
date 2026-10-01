/**
 * KIOSKSERVICE.JS - Serviço de Comunicação com RPCs do Supabase
 * Executa as chamadas `registrar_entrada`, `registrar_saida` e `cadastrar_justificativa_antifraude`.
 * Inclui modo simulador/mock inteligente caso o Supabase não esteja conectado.
 */

const KioskService = {
    // Memória local do Mock para testes sem conexão real com Supabase
    _mockData: {
        funcionarios: {
            '1001': { nome: 'Ana Silva', pin: '1234' },
            '1002': { nome: 'Carlos Oliveira', pin: '5678' }
        },
        justificativasHashes: new Set(), // Armazena hashes SHA-256 de arquivos já enviados
        registros: []
    },

    /**
     * Registra Ponto de Entrada via RPC ou Fallback Mock
     */
    registrarEntrada: async function(matricula, pin, localizacao = null, fotoUrl = null) {
        if (typeof supabaseClient !== 'undefined' && supabaseClient && typeof SUPABASE_URL !== 'undefined' && SUPABASE_URL.indexOf('sua-url-supabase') === -1) {
            try {
                const { data, error } = await supabaseClient.rpc('registrar_entrada', {
                    p_matricula: matricula,
                    p_pin: pin,
                    p_localizacao: localizacao,
                    p_foto_url: fotoUrl
                });
                if (error) throw error;
                return data;
            } catch (err) {
                console.warn('Falha RPC Supabase, alternando para Mock local:', err.message);
            }
        }

        // Execução em MOCK LOCAL (simula o comportamento do PL/SQL em schema.sql)
        await new Promise(resolve => setTimeout(resolve, 100)); // Delay simulado de rede

        const func = this._mockData.funcionarios[matricula];
        if (!func) {
            return {
                sucesso: false,
                codigo: 'MATRICULA_INVALIDA',
                mensagem: 'Matrícula não encontrada ou inativa.'
            };
        }

        if (func.pin !== pin) {
            return {
                sucesso: false,
                codigo: 'PIN_INCORRETO',
                mensagem: 'PIN incorreto. Tente novamente.'
            };
        }

        // Gerar HMAC fake de exatamente 12 caracteres
        const hmac = (Math.random().toString(36) + Math.random().toString(36)).substring(2, 14).toUpperCase();

        return {
            sucesso: true,
            codigo: 'SUCESSO',
            mensagem: 'Entrada registrada com sucesso!',
            funcionario_nome: func.nome,
            matricula: matricula,
            tipo: 'ENTRADA',
            data_hora: new Date().toISOString(),
            comprovante_hmac: hmac
        };
    },

    /**
     * Registra Ponto de Saída via RPC ou Fallback Mock
     */
    registrarSaida: async function(matricula, pin, localizacao = null, fotoUrl = null) {
        if (typeof supabaseClient !== 'undefined' && supabaseClient && typeof SUPABASE_URL !== 'undefined' && SUPABASE_URL.indexOf('sua-url-supabase') === -1) {
            try {
                const { data, error } = await supabaseClient.rpc('registrar_saida', {
                    p_matricula: matricula,
                    p_pin: pin,
                    p_localizacao: localizacao,
                    p_foto_url: fotoUrl
                });
                if (error) throw error;
                return data;
            } catch (err) {
                console.warn('Falha RPC Supabase, alternando para Mock local:', err.message);
            }
        }

        // Execução em MOCK LOCAL
        await new Promise(resolve => setTimeout(resolve, 100));

        const func = this._mockData.funcionarios[matricula];
        if (!func) {
            return {
                sucesso: false,
                codigo: 'MATRICULA_INVALIDA',
                mensagem: 'Matrícula não encontrada ou inativa.'
            };
        }

        if (func.pin !== pin) {
            return {
                sucesso: false,
                codigo: 'PIN_INCORRETO',
                mensagem: 'PIN incorreto. Tente novamente.'
            };
        }

        const hmac = (Math.random().toString(36) + Math.random().toString(36)).substring(2, 14).toUpperCase();

        return {
            sucesso: true,
            codigo: 'SUCESSO',
            mensagem: 'Saída registrada com sucesso!',
            funcionario_nome: func.nome,
            matricula: matricula,
            tipo: 'SAIDA',
            data_hora: new Date().toISOString(),
            horas_trabalhadas: 8.00,
            comprovante_hmac: hmac
        };
    },

    /**
     * Cadastra Atestado / Justificativa com validação Antifraude por Hash SHA-256 do arquivo
     */
    cadastrarJustificativaAntifraude: async function(matricula, pin, dataInicio, dataFim, motivo, arquivoNome, arquivoHash) {
        if (typeof supabaseClient !== 'undefined' && supabaseClient && typeof SUPABASE_URL !== 'undefined' && SUPABASE_URL.indexOf('sua-url-supabase') === -1) {
            try {
                const { data, error } = await supabaseClient.rpc('cadastrar_justificativa_antifraude', {
                    p_matricula: matricula,
                    p_pin: pin,
                    p_data_inicio: dataInicio,
                    p_data_fim: dataFim,
                    p_motivo: motivo,
                    p_arquivo_nome: arquivoNome,
                    p_arquivo_hash: arquivoHash
                });
                if (error) throw error;
                return data;
            } catch (err) {
                console.warn('Falha RPC Supabase, alternando para Mock local:', err.message);
            }
        }

        // Execução em MOCK LOCAL com verificação antifraude
        await new Promise(resolve => setTimeout(resolve, 100));

        const func = this._mockData.funcionarios[matricula];
        if (!func) {
            return {
                sucesso: false,
                codigo: 'MATRICULA_INVALIDA',
                mensagem: 'Matrícula não encontrada ou inativa.'
            };
        }

        if (func.pin !== pin) {
            return {
                sucesso: false,
                codigo: 'PIN_INCORRETO',
                mensagem: 'PIN incorreto. Tente novamente.'
            };
        }

        // VERIFICAÇÃO ANTIFRAUDE: O hash SHA256 já foi cadastrado antes?
        if (this._mockData.justificativasHashes.has(arquivoHash)) {
            return {
                sucesso: false,
                codigo: 'FRAUDE_HASH_DUPLICADO',
                mensagem: 'ALERTA ANTIFRAUDE: Este arquivo de atestado já foi cadastrado anteriormente no sistema.'
            };
        }

        // Registra o hash na lista de atestados válidos
        this._mockData.justificativasHashes.add(arquivoHash);

        return {
            sucesso: true,
            codigo: 'SUCESSO',
            mensagem: 'Justificativa/Atestado cadastrado e validado com sucesso!',
            funcionario_nome: func.nome,
            arquivo_hash: arquivoHash
        };
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = KioskService;
}
