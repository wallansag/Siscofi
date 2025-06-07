const API_URL = 'http://localhost:3000';

document.addEventListener('DOMContentLoaded', () => {
    const requestContainer = document.getElementById('requestContainer');
    const resetContainer = document.getElementById('resetContainer');
    
    const requestRecoveryForm = document.getElementById('requestRecoveryForm');
    const resetPasswordForm = document.getElementById('resetPasswordForm');
    
    
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const userId = urlParams.get('userId');

    if (token && userId) {
        
        requestContainer.classList.add('hidden');
        resetContainer.classList.remove('hidden');
    } else {
        
        requestContainer.classList.remove('hidden');
        resetContainer.classList.add('hidden');
    }

    
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
                    
                    window.location.href = 'index.html';
                }

            } catch (error) {
                console.error('Erro ao redefinir senha:', error);
                alert('Erro ao tentar redefinir a senha. O link pode ter expirado.');
            }
        });
    }
});