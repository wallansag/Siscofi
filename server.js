// server/server.js
const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');

// Configuração do servidor Express
const app = express();
const port = 3000;

// Configuração do MySQL
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root', // Coloque o seu usuário do MySQL
  password: '', // Coloque a sua senha do MySQL
  database: 'siscofi' // Nome do seu banco de dados
});

// Conectar ao banco de dados
db.connect((err) => {
  if (err) throw err;
  console.log('Conectado ao MySQL!');
});

// Middleware para ler dados do corpo da requisição (JSON)
app.use(bodyParser.urlencoded({ extended: true }));

// Endpoint para receber dados do formulário
app.post('/submit-form', (req, res) => {
  const { nome, cpf, email, telefone, genero, data_nascimento, senha } = req.body;

  // Query SQL para inserir os dados no banco
  const query = 'INSERT INTO usuarios (nome, cpf, email, telefone, genero, data_nascimento, senha) VALUES (?, ?, ?, ?, ?, ?, ?)';
  db.query(query, [nome, cpf, email, telefone, genero, data_nascimento, senha], (err, result) => {
    if (err) {
      console.error(err);
      res.status(500).send('Erro ao inserir dados');
    } else {
      res.status(200).send('Dados inseridos com sucesso!');
    }
  });
});

// Iniciar o servidor
app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
