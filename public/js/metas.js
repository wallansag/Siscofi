import { getUserName, redirectToLoginIfNotAuthenticated, logout, fetchWithAuth, formatCurrency } from './auth.js';

document.addEventListener('DOMContentLoaded', () => {
    redirectToLoginIfNotAuthenticated();
    
    const logoutButton = document.getElementById('logoutButton');
    if(logoutButton) logoutButton.addEventListener('click', (e) => {
        e.preventDefault();
        logout();
    });
    
    setupEventListeners();
    loadMetas();
});

function setupEventListeners() {
    const openAddMetaModalBtn = document.getElementById('openAddMetaModalBtn');
    const metaModal = document.getElementById('metaModal');
    const cancelMetaBtn = document.getElementById('cancelMetaBtn');
    const metaForm = document.getElementById('metaForm');
    const metasContainer = document.getElementById('metasContainer');

    openAddMetaModalBtn.addEventListener('click', () => {
        metaForm.reset();
        document.getElementById('metaId').value = '';
        document.getElementById('modalTitle').textContent = 'Adicionar Nova Meta';
        metaModal.classList.remove('hidden');
    });

    cancelMetaBtn.addEventListener('click', () => metaModal.classList.add('hidden'));
    metaForm.addEventListener('submit', handleMetaSubmit);
    
    metasContainer.addEventListener('click', (e) => {
        const target = e.target;
        const metaCard = target.closest('.meta-card');
        if (!metaCard) return;

        const metaId = metaCard.dataset.id;
        
        if (target.closest('.btn-delete')) {
            if (confirm('Tem certeza que deseja excluir esta meta?')) {
                deleteMeta(metaId);
            }
        }
    });
}

async function handleMetaSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('metaId').value;
     const meta = {
        nome_meta: document.getElementById('metaNome').value,
        valor_alvo: parseFloat(document.getElementById('metaValor').value),
        tipo_meta: document.getElementById('metaCategoria').value,
        data_limite: document.getElementById('metaPrazo').value || null,
        descricao: document.getElementById('metaDescricao').value || null 
    };

    const method = id ? 'PUT' : 'POST';
    const url = id ? `/metas/${id}` : `/metas`;

    try {
        const response = await fetchWithAuth(url, {
            method,
            body: JSON.stringify(meta)
        });
        if (!response.ok) throw new Error('Falha ao salvar a meta.');
        
        document.getElementById('metaModal').classList.add('hidden');
        loadMetas();
    } catch (error) {
        alert(error.message);
    }
}

async function deleteMeta(id) {
    try {
        const response = await fetchWithAuth(`/metas/${id}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Falha ao excluir a meta.');
        loadMetas();
    } catch (error) {
        alert(error.message);
    }
}

async function loadMetas() {
    const container = document.getElementById('metasContainer');
    container.innerHTML = '<p>Carregando metas...</p>';
    
    try {
        const response = await fetchWithAuth('/metas');
        if (!response.ok) throw new Error('Não foi possível carregar as metas.');
        
        const metas = await response.json();
        container.innerHTML = '';

        if (metas.length === 0) {
            container.innerHTML = '<p>Você ainda não tem nenhuma meta. Que tal adicionar uma?</p>';
            return;
        }

        metas.forEach(meta => {
            const card = document.createElement('div');
            card.className = 'meta-card';
            card.dataset.id = meta.id;

            const progresso = (meta.valor_acumulado / meta.valor_alvo) * 100;
            const corProgresso = progresso >= 100 ? 'var(--accent-color)' : 'var(--primary-color)';

            card.innerHTML = `
                <h4>${meta.nome_meta}</h4>
                <div class="meta-valores">
                    <span>${formatCurrency(meta.valor_acumulado)}</span> / <span>${formatCurrency(meta.valor_alvo)}</span>
                </div>
                <div class="progress-bar-container">
                    <div class="progress-bar" style="width: ${progresso}%; background-color: ${corProgresso};"></div>
                </div>
                <div class="meta-info">
                    <span class="meta-categoria">${meta.tipo_meta.replace('_', ' ')}</span>
                    <span class="meta-progresso">${progresso.toFixed(1)}%</span>
                </div>
                <div class="meta-actions">
                    <button class="btn btn-sm btn-delete"><i class="fas fa-trash"></i></button>
                </div>
            `;
            container.appendChild(card);
        });
    } catch (error) {
        container.innerHTML = `<p style="color: red;">${error.message}</p>`;
    }
}