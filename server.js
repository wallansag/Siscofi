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
    const { tipo, descricao, valor, data, categoria, tipo_recorrencia } = req.body;
    const usuario_id = req.user.userId;
    if (!validateRequiredFields(res, ['tipo', 'descricao', 'valor', 'data', 'tipo_recorrencia'], req.body)) return;
    if (valor <= 0) return res.status(400).json({ message: 'O valor da movimentação deve ser maior que zero.' });
    if (!['ganho', 'gasto'].includes(tipo)) return res.status(400).json({ message: 'O tipo da movimentação deve ser "ganho" ou "gasto".' });
    try {
        const sql = `INSERT INTO movimentacoes (usuario_id, tipo, descricao, valor, data, categoria, tipo_recorrencia) VALUES (?, ?, ?, ?, ?, ?, ?)`;
        const [result] = await pool.query(sql, [usuario_id, tipo, descricao, valor, data, categoria, tipo_recorrencia]);
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
    const { tipo, descricao, valor, data, categoria, tipo_recorrencia } = req.body;
    const usuario_id = req.user.userId;

    if (!validateRequiredFields(res, ['tipo', 'descricao', 'valor', 'data', 'tipo_recorrencia'], req.body)) return;
    if (valor <= 0) return res.status(400).json({ message: 'O valor da movimentação deve ser maior que zero.' });
    if (!['ganho', 'gasto'].includes(tipo)) return res.status(400).json({ message: 'O tipo da movimentação deve ser "ganho" ou "gasto".' });

    try {
        const sql = `UPDATE movimentacoes SET tipo = ?, descricao = ?, valor = ?, data = ?, categoria = ?, tipo_recorrencia = ? WHERE id = ? AND usuario_id = ?`;
        const [result] = await pool.query(sql, [tipo, descricao, valor, data, categoria, tipo_recorrencia, id, usuario_id]);
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

app.post('/metas', authenticateToken, async (req, res) => {
    const { nome_meta, tipo_meta, valor_alvo, data_limite, descricao } = req.body;
    const usuario_id = req.user.userId;

    if (!validateRequiredFields(res, ['nome_meta', 'tipo_meta', 'valor_alvo'], req.body)) return;
    if (valor_alvo <= 0) return res.status(400).json({ message: 'O valor alvo da meta deve ser maior que zero.' });

    try {
        const sql = `INSERT INTO metas (usuario_id, nome_meta, tipo_meta, valor_alvo, data_inicio, data_limite, descricao) VALUES (?, ?, ?, ?, CURDATE(), ?, ?)`;
        const [result] = await pool.query(sql, [usuario_id, nome_meta, tipo_meta, valor_alvo, data_limite, descricao]);
        res.status(201).json({ message: 'Meta adicionada com sucesso!', id: result.insertId });
    } catch (err) {
        handleServerError(res, err, 'Erro ao adicionar meta.');
    }
});

app.get('/metas', authenticateToken, async (req, res) => {
    const userId = req.user.userId;

    try {
        const sql = 'SELECT id, nome_meta, tipo_meta, valor_alvo, valor_acumulado, data_inicio, data_limite, descricao, ativa FROM metas WHERE usuario_id = ? ORDER BY data_inicio DESC';
        const [results] = await pool.query(sql, [userId]);
        res.status(200).json(results);
    } catch (err) {
        handleServerError(res, err, 'Erro ao buscar metas.');
    }
});

app.get('/metas/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.userId;

    try {
        const sql = 'SELECT id, nome_meta, tipo_meta, valor_alvo, valor_acumulado, data_inicio, data_limite, descricao, ativa FROM metas WHERE id = ? AND usuario_id = ?';
        const [result] = await pool.query(sql, [id, userId]);
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

    try {
        const sql = 'DELETE FROM metas WHERE id = ? AND usuario_id = ?';
        const [result] = await pool.query(sql, [id, userId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Meta não encontrada ou não pertence a este usuário.' });
        }
        res.status(200).json({ message: 'Meta excluída com sucesso!' });
    } catch (err) {
        handleServerError(res, err, 'Erro ao excluir meta.');
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