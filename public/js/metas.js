import { getUserName, getToken, logout, fetchWithAuth, formatCurrency, getUserRole } from './auth.js';

let chartInstances = {};

document.addEventListener('DOMContentLoaded', () => {
    if (!getToken()) {
        logout();
        return;
    }
    
    const logoutButton = document.getElementById('logoutButton');
    if(logoutButton) logoutButton.addEventListener('click', (e) => {
        e.preventDefault();
        logout();
    });
    
    const userRole = getUserRole();
    if (userRole === 'ADMIN') {
        const mainNav = document.querySelector('.main-nav');
        const logoutBtn = document.getElementById('logoutButton');
        if (mainNav && logoutBtn && !document.querySelector('a[href="admin-usuarios.html"]')) {
            const adminLink = document.createElement('a');
            adminLink.href = 'admin-usuarios.html';
            adminLink.textContent = 'Admin';
            mainNav.insertBefore(adminLink, logoutBtn);
        }
    }
    
    setupEventListeners();
    loadMetas();
    loadSaldoSiscofiAtual(); 
});

function setupEventListeners() {
    const openAddMetaModalBtn = document.getElementById('openAddMetaModalBtn');
    const metaModal = document.getElementById('metaModal');
    const cancelMetaBtn = document.getElementById('cancelMetaBtn');
    const metaForm = document.getElementById('metaForm');
    const metasContainer = document.getElementById('metasContainer');
    const distribuirSaldoForm = document.getElementById('distribuirSaldoForm');
    
    if(openAddMetaModalBtn) {
        openAddMetaModalBtn.addEventListener('click', () => {
            if(openAddMetaModalBtn.disabled) {
                alert('Você atingiu o limite máximo de 3 metas. Para criar uma nova, delete uma existente.');
                return;
            }
            metaForm.reset();
            document.getElementById('metaId').value = '';
            document.getElementById('modalTitle').textContent = 'Adicionar Nova Meta';
            metaModal.classList.remove('hidden');
        });
    }

    if(cancelMetaBtn && metaModal) {
        cancelMetaBtn.addEventListener('click', () => metaModal.classList.add('hidden'));
    }
    
    if(metaForm) {
        metaForm.addEventListener('submit', handleMetaSubmit);
    }
    
    if(distribuirSaldoForm) {
        distribuirSaldoForm.addEventListener('submit', handleDistribuirSaldoSubmit);
    }
    
    if(metasContainer) {
        metasContainer.addEventListener('click', (e) => {
            const target = e.target;
            const metaCard = target.closest('.meta-card');
            if (!metaCard) return;
            const metaId = metaCard.dataset.id;
            
            if (target.closest('.btn-delete-meta')) {
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

    if (id) {
        const originalMeta = await getMetaById(id);
        if(originalMeta) {
            metaData.valor_acumulado = originalMeta.valor_acumulado;
            metaData.ativa = originalMeta.ativa;
        } else {
            alert('Erro: Meta original não encontrada para atualização.');
            return;
        }
    }

    const method = id ? 'PUT' : 'POST';
    const url = id ? `/metas/${id}` : `/metas`;

    try {
        const response = await fetchWithAuth(url, { method, body: JSON.stringify(metaData) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Falha ao salvar a meta.');
        
        alert(result.message || 'Meta salva com sucesso!');
        document.getElementById('metaModal').classList.add('hidden');
        loadMetas();
        loadSaldoSiscofiAtual();
    } catch (error) {
        alert(error.message);
    }
}

async function getMetaById(id) {
    try {
        const response = await fetchWithAuth(`/metas/${id}`);
        if (!response.ok) return null;
        return await response.json();
    } catch (error) {
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
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Falha ao excluir a meta.');
        alert(result.message || 'Meta excluída com sucesso!');
        loadMetas();
        loadSaldoSiscofiAtual();
    } catch (error) {
        alert(error.message);
    }
}

async function loadSaldoSiscofiAtual() {
    const saldoDisplay = document.getElementById('saldoSiscofiAtualDisplay');
    if (!saldoDisplay) return;
    saldoDisplay.textContent = 'Carregando...';
    try {
        const response = await fetchWithAuth('/api/dashboard/resumo');
        if (!response.ok) throw new Error('Não foi possível carregar o saldo Siscofi.');
        const data = await response.json();
        saldoDisplay.textContent = formatCurrency(data.saldoAtual);
    } catch (error) {
        saldoDisplay.textContent = 'Erro ao carregar.';
    }
}

async function handleDistribuirSaldoSubmit(e) {
    e.preventDefault();
    const valorInput = document.getElementById('valorParaDistribuir');
    const messageDiv = document.getElementById('distribuirSaldoMessage');
    if(!messageDiv) return;
    messageDiv.textContent = '';
    const valor_a_distribuir = parseFloat(valorInput.value);

    if (isNaN(valor_a_distribuir) || valor_a_distribuir <= 0) {
        messageDiv.textContent = 'Por favor, insira um valor positivo para distribuir.';
        messageDiv.style.color = 'red';
        return;
    }
    try {
        const response = await fetchWithAuth('/api/metas/distribuir-saldo', {
            method: 'POST',
            body: JSON.stringify({ valor_a_distribuir })
        });
        
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Falha ao distribuir saldo.');
        
        messageDiv.textContent = result.message || 'Saldo distribuído com sucesso!';
        messageDiv.style.color = 'green';
        valorInput.value = '';
        loadMetas(); 
        loadSaldoSiscofiAtual();
    } catch (error) {
        messageDiv.textContent = `Erro: ${error.message}`;
        messageDiv.style.color = 'red';
    }
}

async function getAllMetasData(){
    try{
        const response = await fetchWithAuth('/metas');
        if (!response.ok) return [];
        return await response.json();
    } catch(e){
        return [];
    }
}

async function loadMetas() {
    const container = document.getElementById('metasContainer');
    const openAddMetaModalBtn = document.getElementById('openAddMetaModalBtn');
    const metaLimitMessageEl = document.getElementById('metaLimitMessage');

    if (!container || !openAddMetaModalBtn || !metaLimitMessageEl) return;
    container.innerHTML = '<p>Carregando metas...</p>';
    
    try {
        const metas = await getAllMetasData();
        container.innerHTML = '';
        
        if (metas.length >= 3) {
            openAddMetaModalBtn.disabled = true;
            openAddMetaModalBtn.title = 'Você atingiu o limite de 3 metas.';
            metaLimitMessageEl.textContent = 'Você atingiu o limite máximo de 3 metas.';
            metaLimitMessageEl.style.display = 'block';
        } else {
            openAddMetaModalBtn.disabled = false;
            openAddMetaModalBtn.title = 'Adicionar Nova Meta';
            metaLimitMessageEl.style.display = 'none';
        }

        if (metas.length === 0) {
            container.innerHTML = '<p>Você ainda não tem nenhuma meta. Que tal adicionar uma?</p>';
            clearCharts();
            return;
        }

        metas.forEach(meta => {
            const cardHtml = createMetaCardHtml(meta);
            container.insertAdjacentHTML('beforeend', cardHtml);
        });
        
        loadMetasCharts(metas);
    } catch (error) {
        container.innerHTML = `<p style="color: red;">${error.message || 'Erro ao carregar metas.'}</p>`;
        clearCharts();
    }
}

function createMetaCardHtml(meta) {
    const progresso = meta.valor_alvo > 0 ? (meta.valor_acumulado / meta.valor_alvo) * 100 : 0;
    const corProgresso = progresso >= 100 ? 'var(--accent-color)' : 'var(--primary-color)';
    const dataLimiteFormatada = meta.data_limite ? new Date(meta.data_limite).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : 'Sem prazo';
    const statusMeta = (meta.ativa === 1 || meta.ativa === true) ? 'Ativa' : 'Inativa/Concluída';

    return `
        <div class="meta-card" data-id="${meta.id}">
            <h4>${meta.nome_meta} (${statusMeta})</h4>
            <p class="meta-descricao-card">${meta.descricao || 'Sem descrição adicional.'}</p>
            <div class="meta-valores">
                <span>${formatCurrency(meta.valor_acumulado)}</span> / <span>${formatCurrency(meta.valor_alvo)}</span>
            </div>
            <div class="progress-bar-container">
                <div class="progress-bar" style="width: ${Math.min(progresso, 100)}%; background-color: ${corProgresso};"></div>
            </div>
            <div class="meta-info">
                <span class="meta-categoria">${meta.tipo_meta.replace('_', ' ')}</span>
                <span class="meta-prazo">Prazo: ${dataLimiteFormatada}</span>
                <span class="meta-progresso">${progresso.toFixed(1)}%</span>
            </div>
            <div class="meta-actions">
                <button class="btn btn-sm btn-edit-meta"><i class="fas fa-edit"></i> Editar</button>
                <button class="btn btn-sm btn-delete-meta"><i class="fas fa-trash"></i> Excluir</button>
            </div>
        </div>
    `;
}

function loadMetasCharts(metas) {
    renderProgressoMetasChart(metas);
    renderMetasPorCategoriaChart(metas);
}

function clearCharts() {
    Object.keys(chartInstances).forEach(key => {
        if(chartInstances[key]) {
            chartInstances[key].destroy();
            delete chartInstances[key];
        }
    });
}

function renderProgressoMetasChart(metas) {
    const canvasId = 'progressoMetasChart';
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;
    if (chartInstances[canvasId]) chartInstances[canvasId].destroy();

    const metasAtivas = metas.filter(m => m.ativa === 1 || m.ativa === true);
    if (metasAtivas.length === 0) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        delete chartInstances[canvasId];
        ctx.font = "16px Arial";
        ctx.textAlign = "center";
        ctx.fillText("Sem metas ativas para exibir progresso.", ctx.canvas.width / 2, ctx.canvas.height / 2);
        return;
    }

    chartInstances[canvasId] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: metasAtivas.map(m => m.nome_meta),
            datasets: [{
                label: 'Valor Acumulado',
                data: metasAtivas.map(m => m.valor_acumulado),
                backgroundColor: 'rgba(72, 187, 120, 0.6)',
            }, {
                label: 'Valor Restante',
                data: metasAtivas.map(m => Math.max(0, m.valor_alvo - m.valor_acumulado)),
                backgroundColor: 'rgba(239, 68, 68, 0.6)',
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false, indexAxis: 'y',
            scales: { x: { stacked: true }, y: { stacked: true } },
            plugins: { tooltip: { callbacks: { label: (context) => `${context.dataset.label}: ${formatCurrency(context.raw)}` } } }
        }
    });
}

function renderMetasPorCategoriaChart(metas) {
    const canvasId = 'metasPorCategoriaChart';
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;
    if (chartInstances[canvasId]) chartInstances[canvasId].destroy();

    const metasAtivas = metas.filter(m => m.ativa === 1 || m.ativa === true);
    if (metasAtivas.length === 0) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        delete chartInstances[canvasId];
        ctx.font = "16px Arial";
        ctx.textAlign = "center";
        ctx.fillText("Sem metas para exibir por categoria.", ctx.canvas.width / 2, ctx.canvas.height / 2);
        return;
    }

    const dataPorCategoria = metasAtivas.reduce((acc, meta) => {
        const tipo = meta.tipo_meta.replace('_', ' ');
        acc[tipo] = (acc[tipo] || 0) + parseFloat(meta.valor_alvo);
        return acc;
    }, {});

    chartInstances[canvasId] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(dataPorCategoria),
            datasets: [{
                data: Object.values(dataPorCategoria),
                backgroundColor: ['#4299e1', '#f6ad55', '#48bb78', '#ed8936', '#a0aec0', '#ecc94b']
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { tooltip: { callbacks: { label: (context) => `${context.label}: ${formatCurrency(context.raw)}` } } }
        }
    });
}