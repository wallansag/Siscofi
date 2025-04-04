const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'C:\Users\walla\siscofi.sqbpro');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("Erro ao conectar ao banco de dados", err.message);
    } else {
        console.log("Conectado ao banco de dados SQLite.");
    }
});

function salvarInscricao(formData) {
    return new Promise((resolve, reject) => {
        const { nome, cpf, email, telefone, genero, data_nascimento, senha } = formData;
        const sql = `INSERT INTO inscricoes (nome, cpf, email, telefone, genero, data_nascimento, senha) VALUES (?, ?, ?, ?, ?, ?, ?)`;
        
        db.run(sql, [nome, cpf, email, telefone, genero, data_nascimento, senha], function (err) {
            if (err) {
                console.error("Erro ao inserir dados:", err.message);
                reject(err);
            } else {
                console.log(`Uma linha foi inserida com o ID: ${this.lastID}`);
                resolve(this.lastID);
            }
        });
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    const form = document.querySelector('form');
    
    // Get form data
    const nome = document.getElementById('nome').value;
    const cpf = document.getElementById('cpf').value;
    const email = document.getElementById('email').value;
    const telefone = document.getElementById('telefone').value;
    const genero = parseInt(form.querySelector('select[name="genero"]').value);
    const dataNascimento = document.getElementById('data-nascimento').value;
    const senha = document.getElementById('Senha').value;
    
    const formData = {
        nome: nome,
        cpf: cpf,
        email: email,
        telefone: telefone,
        genero: genero,
        data_nascimento: dataNascimento,
        senha: senha
    };
    
    try {
        // Call the function to save the data in the database
        const inscricaoId = await salvarInscricao(formData);
        alert(`Inscrição realizada com sucesso! ID: ${inscricaoId}`);
        form.reset(); // Reset the form after successful submission
    } catch (error) {
        alert("Ocorreu um erro ao salvar a inscrição. Por favor, tente novamente.");
        console.error("Erro ao salvar inscrição:", error);
    }
});
