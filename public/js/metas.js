import { getUserName, redirectToLoginIfNotAuthenticated, logout, fetchWithAuth, formatCurrency } from './auth.js';

const API_URL = 'http://localhost:3000';
let chartInstances = {}; // Para armazenar instâncias de gráficos

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
    
    if(openAddMetaModalBtn) {
        openAddMetaModalBtn.addEventListener('click', () => {
            metaForm.reset();
            document.getElementById('metaId').value = '';
            document.getElementById('modalTitle').textContent = 'Adicionar Nova Meta';
            metaModal.classList.remove('hidden');
        });
    }

    if(cancelMetaBtn) {
        cancelMetaBtn.addEventListener('click', () => metaModal.classList.add('hidden'));
    }
    
    if(metaForm) {
        metaForm.addEventListener('submit', handleMetaSubmit);
    }
    
    if(metasContainer) {
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
            if (target.closest('.btn-edit-meta')) {
                loadMetaForEdit(metaId);
            }
        });
    }
}

async function handleMetaSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('metaId').value;
    const metaData = {
        nome_meta: document.getElementById('metaNome').value,
        valor_alvo: parseFloat(document.getElementById('metaValor').value),
        tipo_meta: document.getElementById('metaCategoria').value,
        data_limite: document.getElementById('metaPrazo').value || null,
        descricao: document.getElementById('metaDescricao').value || null
    };

    if (id) { // Se tem ID, é uma atualização, precisamos do valor_acumulado e ativa
        const originalMeta = await getMetaById(id); // Função auxiliar para buscar a meta original
        if(originalMeta) {
            metaData.valor_acumulado = originalMeta.valor_acumulado;
            metaData.ativa = originalMeta.ativa;
        }
    }


    const method = id ? 'PUT' : 'POST';
    const url = id ? `/metas/${id}` : `/metas`;

    try {
        const response = await fetchWithAuth(url, {
            method,
            body: JSON.stringify(metaData)
        });
        if (!response.ok) {
            const errorResult = await response.json().catch(() => ({message: 'Falha ao salvar a meta.'}));
            throw new Error(errorResult.message);
        }
        
        document.getElementById('metaModal').classList.add('hidden');
        loadMetas();
    } catch (error) {
        alert(error.message);
    }
}

async function getMetaById(id) { // Função auxiliar
    try {
        const response = await fetchWithAuth(`/metas/${id}`);
        if (!response.ok) return null;
        return await response.json();
    } catch (error) {
        console.error("Erro ao buscar meta por ID:", error);
        return null;
    }
}


async function loadMetaForEdit(id) {
    try {
        const meta = await getMetaById(id);
        if (!meta) {
            alert('Meta não encontrada para edição.');
            return;
        }

        document.getElementById('metaId').value = meta.id;
        document.getElementById('metaNome').value = meta.nome_meta;
        document.getElementById('metaValor').value = meta.valor_alvo;
        document.getElementById('metaCategoria').value = meta.tipo_meta;
        document.getElementById('metaPrazo').value = meta.data_limite ? new Date(meta.data_limite).toISOString().split('T')[0] : '';
        document.getElementById('metaDescricao').value = meta.descricao || '';
        
        document.getElementById('modalTitle').textContent = 'Editar Meta';
        document.getElementById('metaModal').classList.remove('hidden');
    } catch (error) {
        alert('Erro ao carregar dados da meta para edição.');
    }
}


async function deleteMeta(id) {
    try {
        const response = await fetchWithAuth(`/metas/${id}`, { method: 'DELETE' });
        if (!response.ok) {
            const errorResult = await response.json().catch(() => ({message: 'Falha ao excluir a meta.'}));
            throw new Error(errorResult.message);
        }
        loadMetas();
    } catch (error) {
        alert(error.message);
    }
}

async function loadMetas() {
    const container = document.getElementById('metasContainer');
    if(!container) return;
    container.innerHTML = '<p>Carregando metas...</p>';
    
    try {
        const response = await fetchWithAuth('/metas');
        if (!response.ok) {
            const errorResult = await response.json().catch(() => ({message: 'Não foi possível carregar as metas.'}));
            throw new Error(errorResult.message);
        }
        
        const metas = await response.json();
        container.innerHTML = '';

        if (metas.length === 0) {
            container.innerHTML = '<p>Você ainda não tem nenhuma meta. Que tal adicionar uma?</p>';
            clearCharts(); // Limpa gráficos se não houver metas
            return;
        }

        metas.forEach(meta => {
            const card = document.createElement('div');
            card.className = 'meta-card';
            card.dataset.id = meta.id;

            const progresso = meta.valor_alvo > 0 ? (meta.valor_acumulado / meta.valor_alvo) * 100 : 0;
            const corProgresso = progresso >= 100 ? 'var(--accent-color)' : 'var(--primary-color)';

            card.innerHTML = `
                <h4>${meta.nome_meta}</h4>
                <div class="meta-valores">
                    <span>${formatCurrency(meta.valor_acumulado)}</span> / <span>${formatCurrency(meta.valor_alvo)}</span>
                </div>
                <div class="progress-bar-container">
                    <div class="progress-bar" style="width: ${Math.min(progresso, 100)}%; background-color: ${corProgresso};"></div>
                </div>
                <div class="meta-info">
                    <span class="meta-categoria">${meta.tipo_meta.replace('_', ' ')}</span>
                    <span class="meta-progresso">${progresso.toFixed(1)}%</span>
                </div>
                <div class="meta-actions">
                    <button class="btn btn-sm btn-edit-meta"><i class="fas fa-edit"></i> Editar</button>
                    <button class="btn btn-sm btn-delete"><i class="fas fa-trash"></i> Excluir</button>
                </div>
            `;
            container.appendChild(card);
        });
        
        renderProgressoMetasChart(metas);
        renderMetasPorCategoriaChart(metas);

    } catch (error) {
        container.innerHTML = `<p style="color: red;">${error.message}</p>`;
        clearCharts();
    }
}

function clearCharts() {
    if (chartInstances['progressoMetasChart']) {
        chartInstances['progressoMetasChart'].destroy();
        delete chartInstances['progressoMetasChart'];
    }
    if (chartInstances['metasPorCategoriaChart']) {
        chartInstances['metasPorCategoriaChart'].destroy();
        delete chartInstances['metasPorCategoriaChart'];
    }
}

function renderProgressoMetasChart(metas) {
    const canvasId = 'progressoMetasChart';
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;

    if (chartInstances[canvasId]) {
        chartInstances[canvasId].destroy();
    }

    const metasAtivas = metas.filter(m => m.ativa);

    chartInstances[canvasId] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: metasAtivas.map(m => m.nome_meta),
            datasets: [
                {
                    label: 'Valor Acumulado',
                    data: metasAtivas.map(m => m.valor_acumulado),
                    backgroundColor: 'rgba(72, 187, 120, 0.6)', // --accent-color
                    borderColor: 'rgba(72, 187, 120, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Valor Restante',
                    data: metasAtivas.map(m => Math.max(0, m.valor_alvo - m.valor_acumulado)),
                    backgroundColor: 'rgba(66, 153, 225, 0.6)', // --primary-color
                    borderColor: 'rgba(66, 153, 225, 1)',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            scales: {
                x: {
                    stacked: true,
                    title: { display: true, text: 'Valor (R$)' },
                     ticks: { callback: value => formatCurrency(value) }
                },
                y: {
                    stacked: true
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + formatCurrency(context.raw);
                        }
                    }
                }
            }
        }
    });
}

function renderMetasPorCategoriaChart(metas) {
    const canvasId = 'metasPorCategoriaChart';
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;

    if (chartInstances[canvasId]) {
        chartInstances[canvasId].destroy();
    }

    const metasAtivas = metas.filter(m => m.ativa);
    const dataPorCategoria = metasAtivas.reduce((acc, meta) => {
        const tipo = meta.tipo_meta.replace('_', ' ');
        acc[tipo] = (acc[tipo] || 0) + meta.valor_alvo;
        return acc;
    }, {});

    chartInstances[canvasId] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(dataPorCategoria),
            datasets: [{
                label: 'Valor Alvo por Categoria',
                data: Object.values(dataPorCategoria),
                backgroundColor: [
                    'rgba(66, 153, 225, 0.7)',
                    'rgba(246, 173, 85, 0.7)',
                    'rgba(72, 187, 120, 0.7)',
                    'rgba(237, 137, 54, 0.7)',
                    'rgba(160, 174, 192, 0.7)',
                    'rgba(236, 201, 75, 0.7)'
                ],
                borderColor: [
                     '#4299e1', '#f6ad55', '#48bb78', '#ed8936', '#a0aec0', '#ecc94b'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                     callbacks: {
                        label: function(context) {
                            let label = context.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed !== null) {
                                label += formatCurrency(context.parsed);
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
}