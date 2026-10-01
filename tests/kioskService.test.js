/**
 * TEST SUITE - Kiosk Ponto Eletrônico
 * Valida a lógica de KioskService (Entrada, Saída, HMAC e Antifraude por SHA-256)
 */

const crypto = require('crypto');

// Polyfill crypto para Node.js environment no Utils se necessário
global.window = {
    crypto: {
        subtle: {
            digest: async (algorithm, buffer) => {
                return crypto.createHash('sha256').update(Buffer.from(buffer)).digest();
            }
        }
    }
};

const Utils = require('../js/utils.js');
const KioskService = require('../js/kioskService.js');

async function runTests() {
    console.log('--- INICIANDO TESTES DO KIOSK PONTO ---');
    let totalTests = 0;
    let passedTests = 0;

    function assert(condition, message) {
        totalTests++;
        if (condition) {
            console.log(`[PASS] ${message}`);
            passedTests++;
        } else {
            console.error(`[FAIL] ${message}`);
        }
    }

    // TEST 1: Validação de Matrícula e PIN incorretos
    const resPinInvalido = await KioskService.registrarEntrada('1001', '0000');
    assert(resPinInvalido.sucesso === false && resPinInvalido.codigo === 'PIN_INCORRETO', 'Deve rejeitar PIN incorreto');

    const resMatInvalida = await KioskService.registrarEntrada('9999', '1234');
    assert(resMatInvalida.sucesso === false && resMatInvalida.codigo === 'MATRICULA_INVALIDA', 'Deve rejeitar Matrícula inexistente');

    // TEST 2: Registro de ENTRADA com sucesso
    const resEntrada = await KioskService.registrarEntrada('1001', '1234');
    assert(resEntrada.sucesso === true && resEntrada.tipo === 'ENTRADA', 'Deve registrar Entrada com sucesso');
    assert(typeof resEntrada.comprovante_hmac === 'string' && resEntrada.comprovante_hmac.length === 12, 'Deve gerar comprovante HMAC de 12 caracteres');

    // TEST 3: Registro de SAÍDA com cálculo de jornada
    const resSaida = await KioskService.registrarSaida('1001', '1234');
    assert(resSaida.sucesso === true && resSaida.tipo === 'SAIDA', 'Deve registrar Saída com sucesso');
    assert(resSaida.horas_trabalhadas > 0, 'Deve retornar cálculo de horas trabalhadas na Saída');

    // TEST 4: Antifraude de Atestados - Primeiro Envio (Sucesso)
    const fakeFileContent = Buffer.from('Conteudo do Atestado Medico Original - Dr. Joao');
    const hashHex = crypto.createHash('sha256').update(fakeFileContent).digest('hex');

    const resAtestado1 = await KioskService.cadastrarJustificativaAntifraude(
        '1001',
        '1234',
        '2025-01-10',
        '2025-01-11',
        'Atestado Médico',
        'atestado.pdf',
        hashHex
    );
    assert(resAtestado1.sucesso === true, 'Deve aceitar primeiro cadastro do atestado original');

    // TEST 5: Antifraude de Atestados - Segundo Envio com Mesmo Hash (Tentativa de Fraude)
    const resAtestado2 = await KioskService.cadastrarJustificativaAntifraude(
        '1002', // Outro funcionário tentando reaproveitar o mesmo atestado
        '5678',
        '2025-01-10',
        '2025-01-11',
        'Atestado Reutilizado',
        'atestado_copia.pdf',
        hashHex // MESMO HASH
    );
    assert(
        resAtestado2.sucesso === false && resAtestado2.codigo === 'FRAUDE_HASH_DUPLICADO',
        'Deve BLOQUEAR por FRAUDE envio de atestado com mesmo hash SHA-256'
    );

    console.log(`\n===================================`);
    console.log(`RESULTADO FINAL: ${passedTests}/${totalTests} testes passaram.`);
    console.log(`===================================\n`);

    if (passedTests !== totalTests) {
        process.exit(1);
    }
}

runTests().catch(err => {
    console.error('Erro fatal nos testes:', err);
    process.exit(1);
});
