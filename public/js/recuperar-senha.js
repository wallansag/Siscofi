const API_URL = 'http://localhost:3000';

document.addEventListener('DOMContentLoaded', () => {
    const requestContainer = document.getElementById('requestContainer');
    const resetContainer = document.getElementById('resetContainer');
    
    const requestRecoveryForm = document.getElementById('requestRecoveryForm');
    const resetPasswordForm = document.getElementById('resetPasswordForm');
    
    // Verifica se há um token de recuperação na URL quando a página carrega
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const userId = urlParams.get('userId');

    if (token && userId) {
        // Se encontrou token e userId, mostra o formulário de redefinição de senha
        requestContainer.classList.add('hidden');
        resetContainer.classList.remove('hidden');
    } else {
        // Se não, mostra o formulário para solicitar o e-mail
        requestContainer.classList.remove('hidden');
        resetContainer.classList.add('hidden');
    }

    // Event listener para o formulário de SOLICITAÇÃO de e-mail (Passo 1)
    if(requestRecoveryForm) {
        requestRecoveryForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('emailRecover').value;

            try {
                const response = await fetch(`${API_URL}/solicitar-recuperacao-senha`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
                const data = await response.json();
                alert(data.message); 
                if (response.ok) {
                    requestRecoveryForm.reset();
                }
            } catch (error) {
                console.error('Erro na requisição de recuperação de senha:', error);
                alert('Erro ao tentar recuperar a senha. Tente novamente mais tarde.');
            }
        });
    }

    // Event listener para o formulário de REDEFINIÇÃO de senha (Passo 2)
    if(resetPasswordForm) {
        resetPasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newPassword = document.getElementById('newPassword').value;
            const confirmNewPassword = document.getElementById('confirmNewPassword').value;

            if (newPassword !== confirmNewPassword) {
                return alert('As senhas não coincidem!');
            }
            if (newPassword.length < 6) {
                return alert('A nova senha deve ter no mínimo 6 caracteres.');
            }

            // Pega o token e o userId da URL novamente para enviar ao backend
            const tokenFromUrl = urlParams.get('token');
            const userIdFromUrl = urlParams.get('userId');

            try {
                const response = await fetch(`${API_URL}/redefinir-senha`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: userIdFromUrl, token: tokenFromUrl, newPassword })
                });

                const data = await response.json();
                alert(data.message);

                if (response.ok) {
                    // Redireciona para a página de login após o sucesso
                    window.location.href = 'index.html';
                }

            } catch (error) {
                console.error('Erro ao redefinir senha:', error);
                alert('Erro ao tentar redefinir a senha. O link pode ter expirado.');
            }
        });
    }
});