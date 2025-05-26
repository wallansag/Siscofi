document.addEventListener('DOMContentLoaded', () => {
    const inscricaoForm = document.getElementById('inscricaoForm');
    const mensagemDiv = document.getElementById('mensagem');
    const submitButton = inscricaoForm.querySelector('button[type="submit"]'); // Seleciona o botão de submit

    // Função para validar formato de email
    const isValidEmail = (email) => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    };

    // Função para validar CPF (exemplo simples, sem dígito verificador)
    const isValidCPF = (cpf) => {
        cpf = cpf.replace(/\D/g, ''); // Remove caracteres não numéricos
        if (cpf.length !== 11) return false;
        // Adicione aqui a lógica completa de validação de CPF se necessário
        return true;
    };

    inscricaoForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const nome = document.getElementById('nome').value.trim(); // Adiciona trim para remover espaços em branco
        const cpf = document.getElementById('cpf').value.trim();
        const email = document.getElementById('email').value.trim();
        const telefone = document.getElementById('telefone').value.trim();
        const genero = document.getElementById('genero').value;
        const data_nascimento = document.getElementById('data_nascimento').value;
        const senha = document.getElementById('senha').value;
        const confirmSenha = document.getElementById('confirm-senha').value;

        // --- VALIDAÇÕES NO FRONTEND ---
        mensagemDiv.textContent = ''; // Limpa mensagens anteriores
        mensagemDiv.style.color = 'red';

        if (!nome || !cpf || !email || !telefone || !genero || !data_nascimento || !senha || !confirmSenha) {
            mensagemDiv.textContent = 'Por favor, preencha todos os campos obrigatórios.';
            return;
        }

        if (senha !== confirmSenha) {
            mensagemDiv.textContent = 'As senhas não coincidem!';
            return;
        }

        if (senha.length < 6) {
            mensagemDiv.textContent = 'A senha deve ter no mínimo 6 caracteres.';
            return;
        }

        if (!isValidEmail(email)) {
            mensagemDiv.textContent = 'Por favor, insira um e-mail válido.';
            return;
        }

        if (!isValidCPF(cpf)) {
            mensagemDiv.textContent = 'Por favor, insira um CPF válido (apenas números).';
            return;
        }

        // Você pode adicionar mais validações aqui para telefone, data, etc.
        // --- FIM DAS VALIDAÇÕES NO FRONTEND ---

        mensagemDiv.textContent = 'Enviando sua inscrição... Por favor, aguarde.';
        mensagemDiv.style.color = 'gray';
        submitButton.disabled = true; // Desabilita o botão de submit

        try {
            const response = await fetch('/cadastrar-usuario', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    nome,
                    cpf,
                    email,
                    telefone,
                    genero,
                    data_nascimento,
                    senha
                })
            });

            const data = await response.json();

            if (response.ok) {
                mensagemDiv.textContent = data.message;
                mensagemDiv.style.color = 'green';
                inscricaoForm.reset();

                setTimeout(() => {
                    window.location.href = '/login.html';
                }, 1500);
            } else {
                mensagemDiv.textContent = `Erro: ${data.message || 'Ocorreu um erro desconhecido ao cadastrar o usuário.'}`;
                mensagemDiv.style.color = 'red';
            }
        } catch (error) {
            console.error('Erro ao enviar o formulário ou conectar com o servidor:', error);
            mensagemDiv.textContent = 'Erro ao conectar com o servidor. Por favor, tente novamente ou verifique se o backend está ativo.';
            mensagemDiv.style.color = 'red';
        } finally {
            submitButton.disabled = false; // Reabilita o botão de submit
        }
    });
});