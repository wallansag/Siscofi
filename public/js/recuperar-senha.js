const API_URL = 'http://localhost:3000';

document.addEventListener('DOMContentLoaded', () => {
    const recoverForm = document.getElementById('recoverForm');
    
    recoverForm.addEventListener('submit', async (e) => {
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
                recoverForm.reset();
            }
        } catch (error) {
            alert('Erro ao tentar recuperar a senha.');
        }
    });
});