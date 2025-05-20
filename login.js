document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.querySelector('form'); // Assumindo que o form de login é o único na página
    const recuperarSenhaButton = document.querySelector('#recuperar\\ senha'); // Selecionando o botão "Esqueci a senha"

    loginForm.addEventListener('submit', function(event) {
        event.preventDefault(); // Evita o envio padrão do formulário

        const cpf = document.getElementById('CPF').value;
        const senha = document.getElementById('Senha').value;

        fetch('/api/login', { // Endpoint da API para login
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ cpf: cpf, senha: senha }),
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('Login realizado com sucesso!');
                // Aqui você pode redirecionar o usuário para a página principal
                window.location.href = 'pagina_principal.html';
            } else {
                alert('Falha no login: ' + data.message);
            }
        })
        .catch((error) => {
            console.error('Erro na requisição:', error);
            alert('Ocorreu um erro ao tentar fazer login.');
        });
    });

    recuperarSenhaButton.addEventListener('click', function(event) {
        event.preventDefault(); // Evita o comportamento padrão do link/botão

        const emailRecuperacao = document.querySelector('.container input[type="email"]').value;

        if (!emailRecuperacao) {
            alert('Por favor, insira seu email para recuperar a senha.');
            return;
        }

        fetch('/api/recuperar-senha', { // Endpoint da API para solicitar recuperação de senha
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email: emailRecuperacao }),
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('Um link de recuperação de senha foi enviado para o seu email.');
                // Você pode redirecionar o usuário para uma página de confirmação
                // window.location.href = 'solicitacao_enviada.html';
            } else {
                alert('Erro ao solicitar recuperação de senha: ' + data.message);
            }
        })
        .catch((error) => {
            console.error('Erro na requisição:', error);
            alert('Ocorreu um erro ao tentar solicitar a recuperação de senha.');
        });
    });
});
