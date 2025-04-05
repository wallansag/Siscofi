
const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');


const app = express();
const port = 3000;


const db = mysql.createConnection({
  host: 'localhost',
  user: 'root', 
  password: 'Genesis@614', 
  database: 'siscofi' 
});


db.connect((err) => {
  if (err) throw err;
  console.log('Conectado ao MySQL!');
});


app.use(bodyParser.urlencoded({ extended: true }));


app.post('/submit-form', (req, res) => {
  const { nome, cpf, email, telefone, genero, data_nascimento, senha } = req.body;

  
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


app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
