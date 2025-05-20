document.addEventListener('DOMContentLoaded', function() {
    const cadastroForm = document.getElementById('registration-form');

    cadastroForm.addEventListener('submit', function(event) {
        event.preventDefault(); // Evita o envio padrão do formulário

        const nome = document.getElementById('nome').value;
        const cpf = document.getElementById('cpf').value;
        const email = document.getElementById('email').value;
        const telefone = document.getElementById('telefone').value;
        const genero = cadastroForm.querySelector('select[name="genero"]').value;
        const data_nascimento = document.getElementById('data_nascimento').value;
        const senha = document.getElementById('senha').value;
        const confirmSenha = document.getElementById('confirm-senha').value;

        if (senha !== confirmSenha) {
            alert('As senhas não coincidem.');
            return;
        }

        fetch('/api/cadastro', { // Endpoint da API para cadastro
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                nome: nome,
                cpf: cpf,
                email: email,
                telefone: telefone,
                genero: genero,
                data_nascimento: data_nascimento,
                senha: senha
            }),
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('Cadastro realizado com sucesso!');
                window.location.href = 'login.html'; // Redireciona para a página de login
            } else {
                alert('Erro no cadastro: ' + data.message);
            }
        })
        .catch((error) => {
            console.error('Erro na requisição:', error);
            alert('Ocorreu um erro ao tentar cadastrar.');
        });
    });
});