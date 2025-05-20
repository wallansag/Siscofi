const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
require('dotenv').config();

const app = express();
const port = 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Conexão com MariaDB
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT
});


// Rota para receber dados do formulário
app.post('/submit-form', async (req, res) => {
  const { nome, cpf, email, telefone, genero, data_nascimento, senha, 'confirm-senha': confirmSenha } = req.body;

  if (senha !== confirmSenha) {
    return res.status(400).send('As senhas não coincidem');
  }

  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(senha, saltRounds);

  const sql = `INSERT INTO usuario (nome, cpf, email, telefone, genero, data_nascimento, senha)
               VALUES (?, ?, ?, ?, ?, ?, ?)`;

  db.query(sql, [nome, cpf, email, telefone, genero, data_nascimento, hashedPassword], (err, result) => {
    if (err) {
      console.error('Erro ao inserir dados:', err.message);
      return res.status(500).send('Erro no servidor');
    }

    res.send('Inscrição realizada com sucesso!');
  });
});

app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});
app.use(express.static('Siscofi'));