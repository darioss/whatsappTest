const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Token de verificação - defina o mesmo no Meta for Developers
const VERIFY_TOKEN = 'seu_token_de_verificacao_aqui';

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Função para salvar logs
function saveLog(data) {
    const timestamp = new Date().toISOString();
    const logData = {
        timestamp,
        data
    };
    
    // Salva em arquivo de log
    const logFile = path.join(__dirname, 'whatsapp_logs.json');
    const logEntry = JSON.stringify(logData, null, 2) + ',\n';
    
    fs.appendFile(logFile, logEntry, (err) => {
        if (err) console.error('Erro ao salvar log:', err);
    });
    
    // Também exibe no console
    console.log('=== WEBHOOK RECEBIDO ===');
    console.log('Timestamp:', timestamp);
    console.log('Dados:', JSON.stringify(data, null, 2));
    console.log('========================\n');
}

// GET - Verificação do webhook (Meta vai chamar isso)
app.get('/webhook/whatsapp', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    
    console.log('Verificação do webhook:', { mode, token, challenge });
    
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('✅ Webhook verificado com sucesso!');
        res.status(200).send(challenge);
    } else {
        console.log('❌ Falha na verificação do webhook');
        res.status(403).send('Forbidden');
    }
});

// POST - Recebe notificações do WhatsApp
app.post('/webhook/whatsapp', (req, res) => {
    const body = req.body;
    
    // Salva todos os dados recebidos
    saveLog(body);
    
    // Processa diferentes tipos de notificação
    if (body.entry && body.entry[0] && body.entry[0].changes) {
        const changes = body.entry[0].changes[0];
        
        if (changes.value.statuses) {
            // Status de mensagens (delivered, read, failed, etc.)
            changes.value.statuses.forEach(status => {
                console.log(`📱 Status da mensagem ${status.id}: ${status.status}`);
                
                if (status.errors) {
                    console.log('❌ ERROS ENCONTRADOS:');
                    status.errors.forEach(error => {
                        console.log(`   Código: ${error.code}`);
                        console.log(`   Título: ${error.title}`);
                        console.log(`   Mensagem: ${error.message}`);
                        
                        // Erros específicos de mídia/vídeo
                        if (error.code === 131026) {
                            console.log('   🎥 ERRO DE MÍDIA: Falha no upload do arquivo');
                        } else if (error.code === 131047) {
                            console.log('   📏 ERRO DE TAMANHO: Arquivo muito grande');
                        } else if (error.code === 131051) {
                            console.log('   🎭 ERRO DE FORMATO: Formato não suportado');
                        }
                    });
                }
            });
        }
        
        if (changes.value.messages) {
            // Mensagens recebidas
            changes.value.messages.forEach(message => {
                console.log(`💬 Mensagem recebida de ${message.from}: ${message.type}`);
            });
        }
    }
    
    // Sempre responde 200 para o WhatsApp
    res.status(200).send('OK');
});

// Endpoint para ver logs salvos
app.get('/logs', (req, res) => {
    const logFile = path.join(__dirname, 'whatsapp_logs.json');
    
    if (fs.existsSync(logFile)) {
        fs.readFile(logFile, 'utf8', (err, data) => {
            if (err) {
                res.status(500).json({ error: 'Erro ao ler logs' });
                return;
            }
            
            // Remove a última vírgula e cria um JSON array válido
            const jsonData = '[' + data.slice(0, -2) + ']';
            
            try {
                const logs = JSON.parse(jsonData);
                res.json({
                    total: logs.length,
                    logs: logs.slice(-10) // Últimos 10 logs
                });
            } catch (parseErr) {
                res.status(500).json({ error: 'Erro ao processar logs' });
            }
        });
    } else {
        res.json({ message: 'Nenhum log encontrado' });
    }
});

// Endpoint para teste
app.get('/', (req, res) => {
    res.json({
        message: 'Webhook WhatsApp rodando!',
        endpoints: {
            webhook: '/webhook/whatsapp',
            logs: '/logs'
        }
    });
});

// Inicia o servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`📱 Webhook URL: http://localhost:${PORT}/webhook/whatsapp`);
    console.log(`📊 Ver logs: http://localhost:${PORT}/logs`);
    console.log(`🔑 Verify Token: ${VERIFY_TOKEN}`);
});

// Tratamento de erros
process.on('uncaughtException', (err) => {
    console.error('Erro não capturado:', err);
});

process.on('unhandledRejection', (err) => {
    console.error('Promise rejeitada:', err);
});
