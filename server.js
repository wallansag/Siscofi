const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});
pool.getConnection()
    .then(connection => {
        console.log('Conectado ao banco de dados MySQL via Pool!');
        connection.release();
    })
    .catch(err => {
        console.error('Erro ao conectar ao banco de dados:', err.stack);
        process.exit(1);
    });
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        return res.status(401).json({ message: 'Token de autenticação não fornecido.' });
    }
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            console.error('Erro de validação de token:', err.message);
            return res.status(403).json({ message: 'Token de autenticação inválido ou expirado.' });
        }
        req.user = user;
        next();
    });
};
const handleServerError = (res, error, message) => {
    console.error(`${message}:`, error.message);
    res.status(500).json({ message: message, error: error.message });
};
const validateRequiredFields = (res, fields, data) => {
    for (const field of fields) {
        if (!data[field]) {
            res.status(400).json({ message: `O campo '${field}' é obrigatório.` });
            return false;
        }
    }
    return true;
};
app.post('/cadastrar-usuario', async (req, res) => {
    const { nome, cpf, email, telefone, genero, data_nascimento, senha } = req.body;
    if (!validateRequiredFields(res, ['nome', 'cpf', 'email', 'telefone', 'genero', 'data_nascimento', 'senha'], req.body)) return;
    if (senha.length < 6) {
        return res.status(400).json({ message: 'A senha deve ter no mínimo 6 caracteres.' });
    }
    try {
        const hashedPassword = await bcrypt.hash(senha, 10);
        const sql = `INSERT INTO usuarios (nome, cpf, email, telefone, genero, data_nascimento, senha_hash) VALUES (?, ?, ?, ?, ?, ?, ?)`;
        const [result] = await pool.query(sql, [nome, cpf, email, telefone, genero, data_nascimento, hashedPassword]);
        res.status(201).json({ message: 'Usuário cadastrado com sucesso!', id: result.insertId });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'CPF ou Email já cadastrado. Por favor, verifique seus dados.', error: err.message });
        }
        handleServerError(res, err, 'Erro interno do servidor ao cadastrar usuário.');
    }
});
app.post('/login', async (req, res) => {
    const { cpf, senha } = req.body;
    if (!validateRequiredFields(res, ['cpf', 'senha'], req.body)) return;
    try {
        const [results] = await pool.query('SELECT id, senha_hash, nome FROM usuarios WHERE cpf = ?', [cpf]);

        if (results.length === 0) {
            return res.status(401).json({ message: 'CPF ou senha inválidos.' });
        }
        const user = results[0];
        const isPasswordValid = await bcrypt.compare(senha, user.senha_hash);

        if (isPasswordValid) {
            const token = jwt.sign({ userId: user.id, userName: user.nome }, process.env.JWT_SECRET, { expiresIn: '1h' });
            return res.status(200).json({ message: 'Login bem-sucedido!', token, userId: user.id, userName: user.nome });
        } else {
            return res.status(401).json({ message: 'CPF ou senha inválidos.' });
        }
    } catch (err) {
        handleServerError(res, err, 'Erro interno do servidor durante o login.');
    }
});
app.post('/solicitar-recuperacao-senha', async (req, res) => {
    const { email } = req.body;
    if (!validateRequiredFields(res, ['email'], req.body)) return;
    try {
        const [userResults] = await pool.query('SELECT id, nome FROM usuarios WHERE email = ?', [email]);
        if (userResults.length === 0) {
            return res.status(200).json({ message: 'Se o e-mail estiver cadastrado, você receberá um link de redefinição de senha.' });
        }
        const { id: userId, nome: userName } = userResults[0];
        const resetToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 3600000);

        await pool.query('INSERT INTO password_resets (user_id, token, expires_at) VALUES (?, ?, ?)', [userId, resetToken, expiresAt]);

        const resetLink = `http://localhost:${port}/recuperar-senha.html?token=${resetToken}&userId=${userId}`;
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Redefinição de Senha Siscofi',
            html: `<p>Olá ${userName},</p>
                   <p>Você solicitou uma redefinição de senha para sua conta Siscofi.</p>
                   <p>Clique neste link para redefinir sua senha: <a href="${resetLink}">${resetLink}</a></p>
                   <p>Este link é válido por 1 hora.</p>
                   <p>Se você não solicitou isso, por favor, ignore este e-mail.</p>
                   <p>Atenciosamente,<br>Equipe Siscofi</p>`
        };
        await transporter.sendMail(mailOptions);
        res.status(200).json({ message: 'Se o e-mail estiver cadastrado, você receberá um link de redefinição de senha.' });
    } catch (err) {
        handleServerError(res, err, 'Erro ao solicitar recuperação de senha.');
    }
});

app.post('/redefinir-senha', async (req, res) => {
    const { userId, token, newPassword } = req.body;
    if (!validateRequiredFields(res, ['userId', 'token', 'newPassword'], req.body)) return;
    if (newPassword.length < 6) {
        return res.status(400).json({ message: 'A nova senha deve ter no mínimo 6 caracteres.' });
    }
    try {
        const [tokenResults] = await pool.query(
            'SELECT * FROM password_resets WHERE user_id = ? AND token = ? AND expires_at > NOW()',
            [userId, token]
        );
        if (tokenResults.length === 0) {
            return res.status(400).json({ message: 'Link de redefinição inválido ou expirado. Por favor, solicite um novo.' });
        }
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await pool.query('UPDATE usuarios SET senha_hash = ? WHERE id = ?', [hashedPassword, userId]);
        await pool.query('DELETE FROM password_resets WHERE user_id = ? AND token = ?', [userId, token]);

        res.status(200).json({ message: 'Senha redefinida com sucesso!' });
    } catch (err) {
        handleServerError(res, err, 'Erro ao redefinir senha.');
    }
});
app.post('/movimentacoes', authenticateToken, async (req, res) => {
    const { tipo, descricao, valor, data, categoria, tipo_recorrencia, conta_recorrente_id } = req.body;
    const usuario_id = req.user.userId;

    if (!validateRequiredFields(res, ['tipo', 'descricao', 'valor', 'data', 'tipo_recorrencia'], req.body)) return;
    if (valor <= 0) return res.status(400).json({ message: 'O valor da movimentação deve ser maior que zero.' });
    if (!['ganho', 'gasto'].includes(tipo)) return res.status(400).json({ message: 'O tipo da movimentação deve ser "ganho" ou "gasto".' });
    
    try {
        const sql = `INSERT INTO movimentacoes (usuario_id, tipo, descricao, valor, data, categoria, tipo_recorrencia, conta_recorrente_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
        const [result] = await pool.query(sql, [usuario_id, tipo, descricao, valor, data, categoria, tipo_recorrencia, conta_recorrente_id || null]);
        res.status(201).json({ message: 'Movimentação adicionada com sucesso!', id: result.insertId });
    } catch (err) {
        handleServerError(res, err, 'Erro ao adicionar movimentação.');
    }
});

app.get('/movimentacoes', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const { startDate, endDate, tipo, categoria } = req.query;

    let sql = 'SELECT id, tipo, descricao, valor, data, categoria, tipo_recorrencia, data_registro FROM movimentacoes WHERE usuario_id = ?';
    const params = [userId];

    if (startDate && endDate) {
        sql += ' AND data BETWEEN ? AND ?';
        params.push(startDate, endDate);
    }
    if (tipo) {
        sql += ' AND tipo = ?';
        params.push(tipo);
    }
    if (categoria) {
        sql += ' AND categoria = ?';
        params.push(categoria);
    }

    sql += ' ORDER BY data DESC, data_registro DESC';

    try {
        const [results] = await pool.query(sql, params);
        res.status(200).json(results);
    } catch (err) {
        handleServerError(res, err, 'Erro ao buscar movimentações.');
    }
});

app.get('/movimentacoes/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.userId;

    try {
        const sql = 'SELECT id, tipo, descricao, valor, data, categoria, tipo_recorrencia, data_registro FROM movimentacoes WHERE id = ? AND usuario_id = ?';
        const [result] = await pool.query(sql, [id, userId]);
        if (result.length === 0) {
            return res.status(404).json({ message: 'Movimentação não encontrada ou não pertence a este usuário.' });
        }
        res.status(200).json(result[0]);
    } catch (err) {
        handleServerError(res, err, 'Erro ao buscar movimentação específica.');
    }
});

app.put('/movimentacoes/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { tipo, descricao, valor, data, categoria, tipo_recorrencia, conta_recorrente_id } = req.body;
    const usuario_id = req.user.userId;

    if (!validateRequiredFields(res, ['tipo', 'descricao', 'valor', 'data', 'tipo_recorrencia'], req.body)) return;
    if (valor <= 0) return res.status(400).json({ message: 'O valor da movimentação deve ser maior que zero.' });
    if (!['ganho', 'gasto'].includes(tipo)) return res.status(400).json({ message: 'O tipo da movimentação deve ser "ganho" ou "gasto".' });

    try {
        const sql = `UPDATE movimentacoes SET tipo = ?, descricao = ?, valor = ?, data = ?, categoria = ?, tipo_recorrencia = ?, conta_recorrente_id = ? WHERE id = ? AND usuario_id = ?`;
        const [result] = await pool.query(sql, [tipo, descricao, valor, data, categoria, tipo_recorrencia, conta_recorrente_id || null, id, usuario_id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Movimentação não encontrada ou não pertence a este usuário.' });
        }
        res.status(200).json({ message: 'Movimentação atualizada com sucesso!' });
    } catch (err) {
        handleServerError(res, err, 'Erro ao atualizar movimentação.');
    }
});

app.delete('/movimentacoes/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.userId;

    try {
        const sql = 'DELETE FROM movimentacoes WHERE id = ? AND usuario_id = ?';
        const [result] = await pool.query(sql, [id, userId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Movimentação não encontrada ou não pertence a este usuário.' });
        }
        res.status(200).json({ message: 'Movimentação excluída com sucesso!' });
    } catch (err) {
        handleServerError(res, err, 'Erro ao excluir movimentação.');
    }
});


app.post('/api/metas/distribuir-saldo', authenticateToken, async (req, res) => {
    const { valor_a_distribuir } = req.body;
    const usuario_id = req.user.userId;

    if (!valor_a_distribuir || typeof valor_a_distribuir !== 'number' || valor_a_distribuir <= 0) {
        return res.status(400).json({ message: 'O valor a distribuir deve ser um número positivo.' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();
        console.log('Transação iniciada para distribuir saldo.');

        const [saldoGeralResults] = await connection.query(
            `SELECT COALESCE(SUM(CASE WHEN tipo = 'ganho' THEN valor ELSE -valor END), 0) AS saldoSiscofi
             FROM movimentacoes
             WHERE usuario_id = ?`,
            [usuario_id]
        );
        const saldoSiscofiDisponivel = parseFloat(saldoGeralResults[0].saldoSiscofi);
        console.log(`Saldo Siscofi disponível: ${saldoSiscofiDisponivel}, Valor a distribuir: ${valor_a_distribuir}`);

        if (valor_a_distribuir > saldoSiscofiDisponivel) {
             console.log('Valor a distribuir excede saldo. Rollback.');
             await connection.rollback();
             return res.status(400).json({ 
                 message: `Valor a distribuir (R$${valor_a_distribuir.toFixed(2)}) excede seu saldo Siscofi disponível (R$${saldoSiscofiDisponivel.toFixed(2)}).` 
             });
        }

        const [metasParaDistribuicao] = await connection.query(
            'SELECT id, nome_meta, valor_alvo, valor_acumulado FROM metas WHERE usuario_id = ? AND ativa = TRUE AND valor_acumulado < valor_alvo',
            [usuario_id]
        );
        console.log(`Metas encontradas para distribuição: ${metasParaDistribuicao.length}`);

        if (metasParaDistribuicao.length === 0) {
            console.log('Nenhuma meta ativa/incompleta. Rollback.');
            await connection.rollback();
            return res.status(404).json({ message: 'Nenhuma meta ativa ou incompleta encontrada para distribuir o saldo.' });
        }

        const valorPorMeta = valor_a_distribuir / metasParaDistribuicao.length;
        console.log(`Valor por meta: ${valorPorMeta}`);

        for (const meta of metasParaDistribuicao) {
            const valorAcumuladoAtual = parseFloat(meta.valor_acumulado);
            const novoValorAcumulado = valorAcumuladoAtual + valorPorMeta;
            console.log(`  Meta ID ${meta.id} (${meta.nome_meta}): Acumulado anterior: ${valorAcumuladoAtual}, Adicionando: ${valorPorMeta}, Novo Acumulado: ${novoValorAcumulado}`);
            
            const [updateResult] = await connection.query(
                'UPDATE metas SET valor_acumulado = ? WHERE id = ? AND usuario_id = ?',
                [novoValorAcumulado, meta.id, usuario_id]
            );
            console.log(`    Resultado do UPDATE para meta ID ${meta.id}: affectedRows = ${updateResult.affectedRows}`);
        }
        
        
        const descricaoGastoMetas = `Distribuição de R$${valor_a_distribuir.toFixed(2)} para ${metasParaDistribuicao.length} meta(s).`;
        const categoriaGastoMetas = "Alocação para Metas"; 
        
        console.log(`Registrando gasto: ${descricaoGastoMetas}, Categoria: ${categoriaGastoMetas}, Valor: ${valor_a_distribuir}`);
        await connection.query(
            `INSERT INTO movimentacoes (usuario_id, tipo, descricao, valor, data, categoria, tipo_recorrencia) 
             VALUES (?, 'gasto', ?, ?, CURDATE(), ?, 'UNICO')`,
            [usuario_id, descricaoGastoMetas, valor_a_distribuir, categoriaGastoMetas]
        );
        console.log('Movimentação de gasto para distribuição de metas registrada.');
     

        await connection.commit();
        console.log('Transação COMITADA com sucesso.');
        res.status(200).json({ 
            message: `R$${valor_a_distribuir.toFixed(2)} distribuídos com sucesso entre ${metasParaDistribuicao.length} meta(s) e registrado como movimentação.`,
            detalhes: metasParaDistribuicao.map(m => ({ nome: m.nome_meta, adicionado: valorPorMeta.toFixed(2) }))
        });

    } catch (err) {
        if (connection) {
            console.error('ERRO durante a transação, realizando ROLLBACK.');
            await connection.rollback();
        }
        console.error('!!! ERRO DETALHADO em /api/metas/distribuir-saldo !!!:', err);
        handleServerError(res, err, 'Erro ao distribuir saldo para as metas.');
    } finally {
        if (connection) {
            console.log('Conexão com DB liberada.');
            connection.release();
        }
    }
});

app.get('/metas', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    try {
        const [results] = await pool.query(
            'SELECT id, nome_meta, tipo_meta, valor_alvo, valor_acumulado, data_inicio, data_limite, descricao, ativa FROM metas WHERE usuario_id = ? ORDER BY data_inicio DESC', 
            [userId]
        );
        res.status(200).json(results);
    } catch (err) {
        handleServerError(res, err, 'Erro ao buscar metas.');
    }
});
app.get('/metas/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.userId;
    try {
        const [result] = await pool.query(
            'SELECT id, nome_meta, tipo_meta, valor_alvo, valor_acumulado, data_inicio, data_limite, descricao, ativa FROM metas WHERE id = ? AND usuario_id = ?', 
            [id, userId]
        );
        if (result.length === 0) {
            return res.status(404).json({ message: 'Meta não encontrada ou não pertence a este usuário.' });
        }
        res.status(200).json(result[0]);
    } catch (err) {
        handleServerError(res, err, 'Erro ao buscar meta específica.');
    }
});

app.put('/metas/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { nome_meta, tipo_meta, valor_alvo, valor_acumulado, data_limite, descricao, ativa } = req.body;
    const usuario_id = req.user.userId;

    if (!validateRequiredFields(res, ['nome_meta', 'tipo_meta', 'valor_alvo'], req.body)) return;
    if (valor_alvo <= 0) return res.status(400).json({ message: 'O valor alvo da meta deve ser maior que zero.' });

    try {
        const sql = `UPDATE metas SET nome_meta = ?, tipo_meta = ?, valor_alvo = ?, valor_acumulado = ?, data_limite = ?, descricao = ?, ativa = ? WHERE id = ? AND usuario_id = ?`;
        const [result] = await pool.query(sql, [nome_meta, tipo_meta, valor_alvo, valor_acumulado, data_limite, descricao, ativa, id, usuario_id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Meta não encontrada ou não pertence a este usuário.' });
        }
        res.status(200).json({ message: 'Meta atualizada com sucesso!' });
    } catch (err) {
        handleServerError(res, err, 'Erro ao atualizar meta.');
    }
});

app.delete('/metas/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.userId;
    let connection;
    try {
        connection = await pool.getConnection();
        const [result] = await connection.query(
            'DELETE FROM metas WHERE id = ? AND usuario_id = ?', 
            [id, userId]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Meta não encontrada ou não pertence a este usuário.' });
        }
        res.status(200).json({ message: 'Meta excluída com sucesso!' });
    } catch (err) {
        handleServerError(res, err, 'Erro ao excluir meta.');
    } finally {
        if (connection) connection.release();
    }
});

app.get('/api/dashboard/resumo', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    try {
        const [monthSummaryResults] = await pool.query(`
            SELECT
                COALESCE(SUM(CASE WHEN tipo = 'ganho' THEN valor ELSE 0 END), 0) AS ganhosMes,
                COALESCE(SUM(CASE WHEN tipo = 'gasto' THEN valor ELSE 0 END), 0) AS gastosMes
            FROM movimentacoes
            WHERE usuario_id = ? AND MONTH(data) = ? AND YEAR(data) = ?;
        `, [userId, currentMonth, currentYear]);

        const { ganhosMes, gastosMes } = monthSummaryResults[0];

        const [totalBalanceResults] = await pool.query(`
            SELECT
                COALESCE(SUM(CASE WHEN tipo = 'ganho' THEN valor ELSE -valor END), 0) AS saldoAtual
            FROM movimentacoes
            WHERE usuario_id = ?;
        `, [userId]);

        const saldoAtual = totalBalanceResults[0].saldoAtual;

        res.status(200).json({
            ganhosMes: parseFloat(ganhosMes),
            gastosMes: parseFloat(gastosMes),
            saldoAtual: parseFloat(saldoAtual)
        });
    } catch (err) {
        handleServerError(res, err, 'Erro ao buscar resumo do dashboard.');
    }
});

app.get('/api/dashboard/ultimas-movimentacoes', authenticateToken, async (req, res) => {
    const userId = req.user.userId;

    try {
        const sql = `
            SELECT id, tipo, descricao, valor, data, categoria, tipo_recorrencia
            FROM movimentacoes
            WHERE usuario_id = ?
            ORDER BY data DESC, data_registro DESC
            LIMIT 5;
        `;
        const [results] = await pool.query(sql, [userId]);
        res.status(200).json(results);
    } catch (err) {
        handleServerError(res, err, 'Erro ao buscar últimas movimentações do dashboard.');
    }
});

app.get('/api/dashboard/historico-movimentacoes', authenticateToken, async (req, res) => {
    const userId = req.user.userId;

    try {
        const sql = `
            SELECT
                YEAR(data) as ano,
                MONTH(data) as mes,
                COALESCE(SUM(CASE WHEN tipo = 'ganho' THEN valor ELSE 0 END), 0) AS ganhos,
                COALESCE(SUM(CASE WHEN tipo = 'gasto' THEN valor ELSE 0 END), 0) AS gastos
            FROM movimentacoes
            WHERE usuario_id = ? AND data >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
            GROUP BY ano, mes
            ORDER BY ano ASC, mes ASC;
        `;
        const [results] = await pool.query(sql, [userId]);

        const monthlyData = {};
        const now = new Date();
        for (let i = 0; i < 6; i++) {
            const date = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
            const year = date.getFullYear();
            const month = date.getMonth() + 1;
            const monthKey = `${year}-${String(month).padStart(2, '0')}`;
            monthlyData[monthKey] = {
                month: monthKey,
                ganhos: 0,
                gastos: 0
            };
        }

        results.forEach(row => {
            const monthKey = `${row.ano}-${String(row.mes).padStart(2, '0')}`;
            if (monthlyData[monthKey]) {
                monthlyData[monthKey].ganhos = parseFloat(row.ganhos);
                monthlyData[monthKey].gastos = parseFloat(row.gastos);
            }
        });

        const sortedData = Object.values(monthlyData).sort((a, b) => {
            const [yearA, monthA] = a.month.split('-').map(Number);
            const [yearB, monthB] = b.month.split('-').map(Number);
            if (yearA !== yearB) return yearA - yearB;
            return monthA - monthB;
        });

        const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
        const labels = sortedData.map(d => {
            const [year, month] = d.month.split('-');
            return `${monthNames[parseInt(month) - 1]} ${year}`;
        });
        const ganhos = sortedData.map(d => d.ganhos);
        const gastos = sortedData.map(d => d.gastos);

        res.status(200).json({
            labels: labels,
            datasets: {
                ganhos: ganhos,
                gastos: gastos
            }
        });

    } catch (err) {
        handleServerError(res, err, 'Erro ao buscar histórico de movimentações do dashboard.');
    }
});

app.get('/api/dashboard/gastos-por-categoria', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    try {
        const sql = `
            SELECT
                COALESCE(categoria, 'Outros') AS categoria,
                COALESCE(SUM(valor), 0) AS total_gasto
            FROM movimentacoes
            WHERE usuario_id = ?
              AND tipo = 'gasto'
              AND MONTH(data) = ?
              AND YEAR(data) = ?
            GROUP BY categoria
            ORDER BY total_gasto DESC;
        `;
        const [results] = await pool.query(sql, [userId, currentMonth, currentYear]);

        const labels = results.map(row => row.categoria);
        const data = results.map(row => parseFloat(row.total_gasto));

        res.status(200).json({
            labels: labels,
            datasets: [{
                data: data
            }]
        });
    } catch (err) {
        handleServerError(res, err, 'Erro ao buscar gastos por categoria do dashboard.');
    }
});

app.get('/api/relatorios', authenticateToken, async (req, res) => {
    const userId = req.user.userId;

    try {
        const [summaryResults] = await pool.query(`
            SELECT
                COALESCE(SUM(CASE WHEN tipo = 'ganho' THEN valor ELSE 0 END), 0) AS totalReceitas,
                COALESCE(SUM(CASE WHEN tipo = 'gasto' THEN valor ELSE 0 END), 0) AS totalDespesas,
                COALESCE(SUM(CASE WHEN tipo = 'ganho' THEN valor ELSE -valor END), 0) AS saldo
            FROM movimentacoes
            WHERE usuario_id = ?;
        `, [userId]);

        const { totalReceitas, totalDespesas, saldo } = summaryResults[0];

        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        const [topExpensesResults] = await pool.query(`
            SELECT
                descricao,
                COALESCE(SUM(valor), 0) AS total_gasto
            FROM movimentacoes
            WHERE usuario_id = ? AND tipo = 'gasto' AND data >= ?
            GROUP BY descricao
            ORDER BY total_gasto DESC
            LIMIT 5;
        `, [userId, oneYearAgo.toISOString().split('T')[0]]);

        const topDespesas = topExpensesResults.map(row => ({
            descricao: row.descricao,
            total_gasto: parseFloat(row.total_gasto)
        }));

        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();

        const [categoryExpensesResults] = await pool.query(`
            SELECT
                COALESCE(categoria, 'Outros') AS categoria,
                COALESCE(SUM(valor), 0) AS total_gasto
            FROM movimentacoes
            WHERE usuario_id = ?
              AND tipo = 'gasto'
              AND MONTH(data) = ?
              AND YEAR(data) = ?
            GROUP BY categoria
            ORDER BY total_gasto DESC;
        `, [userId, currentMonth, currentYear]);

        const expensesByCategory = {};
        categoryExpensesResults.forEach(row => {
            expensesByCategory[row.categoria] = parseFloat(row.total_gasto);
        });

        const [monthlyComparisonResults] = await pool.query(`
            SELECT
                YEAR(data) as ano,
                MONTH(data) as mes,
                COALESCE(SUM(CASE WHEN tipo = 'ganho' THEN valor ELSE 0 END), 0) AS receitas,
                COALESCE(SUM(CASE WHEN tipo = 'gasto' THEN valor ELSE 0 END), 0) AS despesas
            FROM movimentacoes
            WHERE usuario_id = ? AND data >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
            GROUP BY ano, mes
            ORDER BY ano ASC, mes ASC;
        `, [userId]);

        const monthlyComparisonData = [];
        const dateMap = new Map();
        for (let i = 0; i < 12; i++) {
            const date = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
            const year = date.getFullYear();
            const month = date.getMonth() + 1;
            const monthKey = `${year}-${String(month).padStart(2, '0')}`;
            dateMap.set(monthKey, {
                month: monthKey,
                receitas: 0,
                despesas: 0
            });
        }

        monthlyComparisonResults.forEach(row => {
            const monthKey = `${row.ano}-${String(row.mes).padStart(2, '0')}`;
            if (dateMap.has(monthKey)) {
                const dataEntry = dateMap.get(monthKey);
                dataEntry.receitas = parseFloat(row.receitas);
                dataEntry.despesas = parseFloat(row.despesas);
            }
        });
        monthlyComparisonData.push(...Array.from(dateMap.values()));

        res.status(200).json({
            totalReceitas: parseFloat(totalReceitas),
            totalDespesas: parseFloat(totalDespesas),
            saldo: parseFloat(saldo),
            topDespesas,
            expensesByCategory,
            monthlyComparisonData
        });

    } catch (error) {
        handleServerError(res, error, 'Erro ao buscar dados de relatórios.');
    }
});
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.get('/:page.html', authenticateToken, (req, res) => {
    const pageName = req.params.page;
    const filePath = path.join(__dirname, 'public', `${pageName}.html`);
    res.sendFile(filePath, (err) => {
        if (err) {
            console.error(`Erro ao servir ${pageName}.html:`, err);
            res.status(404).send('Página não encontrada.');
        }
    });
});
app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});

const formatCurrency = (value) => {
    const numericValue = Number(value) || 0;
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(numericValue);
};

app.get('/api/dicas', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    let dicasSugeridas = [];

    try {
        const [gastosVinculados] = await pool.query(
            `SELECT cr.id, cr.nome, mov.valor, mov.data
             FROM movimentacoes mov
             JOIN contas_recorrentes cr ON mov.conta_recorrente_id = cr.id
             WHERE mov.usuario_id = ? AND mov.tipo = 'gasto' AND mov.data >= DATE_SUB(CURDATE(), INTERVAL 2 MONTH)
             ORDER BY cr.id, mov.data DESC`,
            [userId]
        );

        const gastosAgrupados = {};
        for (const gasto of gastosVinculados) {
            if (!gastosAgrupados[gasto.id]) {
                gastosAgrupados[gasto.id] = { nome: gasto.nome, valores: [] };
            }
            gastosAgrupados[gasto.id].valores.push({ valor: parseFloat(gasto.valor), data: gasto.data });
        }

        for (const contaId in gastosAgrupados) {
            const conta = gastosAgrupados[contaId];
            if (conta.valores.length >= 2) {
                const valorAtual = conta.valores[0].valor;
                const valorAnterior = conta.valores[1].valor;
                if (valorAtual > valorAnterior * 1.10) {
                    dicasSugeridas.push({
                        titulo: `Atenção com sua conta de "${conta.nome}"!`,
                        descricao: `Notamos um aumento no valor da sua conta de ${conta.nome}. No mês anterior foi ${formatCurrency(valorAnterior)} e no lançamento mais recente foi ${formatCurrency(valorAtual)}. Verifique o motivo do aumento para manter o controle.`
                    });
                }
            }
        }

        res.status(200).json(dicasSugeridas);

    } catch (err) {
        handleServerError(res, err, 'Erro ao buscar dicas financeiras.');
    }
});





app.post('/api/metas/distribuir-saldo', authenticateToken, async (req, res) => {
    const { valor_a_distribuir } = req.body;
    const usuario_id = req.user.userId;

    if (!valor_a_distribuir || typeof valor_a_distribuir !== 'number' || valor_a_distribuir <= 0) {
        return res.status(400).json({ message: 'O valor a distribuir deve ser um número positivo.' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        
        const [saldoGeralResults] = await connection.query(
            `SELECT COALESCE(SUM(CASE WHEN tipo = 'ganho' THEN valor ELSE -valor END), 0) AS saldoSiscofi
             FROM movimentacoes
             WHERE usuario_id = ?`,
            [usuario_id]
        );
        const saldoSiscofiDisponivel = saldoGeralResults[0].saldoSiscofi;

        if (valor_a_distribuir > saldoSiscofiDisponivel) {
         
            await connection.rollback();
            return res.status(400).json({ 
                message: `Valor a distribuir (R$${valor_a_distribuir.toFixed(2)}) excede seu saldo Siscofi disponível (R$${saldoSiscofiDisponivel.toFixed(2)}).` 
            });
        }
        

        
        const [metasParaDistribuicao] = await connection.query(
            'SELECT id, valor_alvo, valor_acumulado FROM metas WHERE usuario_id = ? AND ativa = TRUE AND valor_acumulado < valor_alvo',
            [usuario_id]
        );

        if (metasParaDistribuicao.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Nenhuma meta ativa ou incompleta encontrada para distribuir o saldo.' });
        }

        
        const valorPorMeta = valor_a_distribuir / metasParaDistribuicao.length;

        
        for (const meta of metasParaDistribuicao) {
            const novoValorAcumulado = meta.valor_acumulado + valorPorMeta;
            await connection.query(
                'UPDATE metas SET valor_acumulado = ? WHERE id = ?',
                [novoValorAcumulado, meta.id]
            );
        }


        await connection.commit();
        res.status(200).json({ 
            message: `R$${valor_a_distribuir.toFixed(2)} distribuídos com sucesso entre ${metasParaDistribuicao.length} meta(s). Cada meta recebeu aproximadamente R$${valorPorMeta.toFixed(2)}.`
        });

    } catch (err) {
        if (connection) await connection.rollback();
        handleServerError(res, err, 'Erro ao distribuir saldo para as metas.');
    } finally {
        if (connection) connection.release();
    }
});
app.post('/api/contas-recorrentes', authenticateToken, async (req, res) => {
    const { nome, categoria_padrao } = req.body;
    const usuario_id = req.user.userId;

    if (!nome) {
        return res.status(400).json({ message: 'O nome da conta recorrente é obrigatório.' });
    }

    try {
        const sql = `INSERT INTO contas_recorrentes (usuario_id, nome, categoria_padrao) VALUES (?, ?, ?)`;
        const [result] = await pool.query(sql, [usuario_id, nome, categoria_padrao || null]);
        res.status(201).json({ message: 'Conta recorrente criada com sucesso!', id: result.insertId });
    } catch (err) {
        handleServerError(res, err, 'Erro ao criar conta recorrente.');
    }
});

app.get('/api/contas-recorrentes', authenticateToken, async (req, res) => {
    const usuario_id = req.user.userId;
    try {
        const [results] = await pool.query(
            'SELECT id, nome, categoria_padrao FROM contas_recorrentes WHERE usuario_id = ? AND ativa = TRUE ORDER BY nome ASC',
            [usuario_id]
        );
        res.status(200).json(results);
    } catch (err) {
        handleServerError(res, err, 'Erro ao buscar contas recorrentes.');
    }
});

app.delete('/api/contas-recorrentes/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const usuario_id = req.user.userId;

    try {
        const [result] = await pool.query(
            'UPDATE contas_recorrentes SET ativa = FALSE WHERE id = ? AND usuario_id = ?',
            [id, usuario_id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Conta recorrente não encontrada ou não pertence a este usuário.' });
        }
        res.status(200).json({ message: 'Conta recorrente desativada com sucesso.' });
    } catch (err) {
        handleServerError(res, err, 'Erro ao desativar conta recorrente.');
    }
});