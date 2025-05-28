import { getUserName, redirectToLoginIfNotAuthenticated, logout, fetchWithAuth, formatCurrency } from './auth.js';

document.addEventListener('DOMContentLoaded', () => {
    redirectToLoginIfNotAuthenticated();
    
    const logoutButton = document.getElementById('logoutButton');
    if(logoutButton) logoutButton.addEventListener('click', (e) => {
        e.preventDefault();
        logout();
    });
    
    document.getElementById('welcomeMessage').textContent = `Olá, ${getUserName() || 'Usuário'}!`;

    fetchResumoFinanceiro();
    fetchUltimasMovimentacoes();
    fetchHistoricoMovimentacoes();
    fetchGastosPorCategoria();
});

async function fetchResumoFinanceiro() {
    try {
        const response = await fetchWithAuth('/api/dashboard/resumo');
        if (!response.ok) throw new Error('Erro ao buscar resumo');
        const data = await response.json();
        document.getElementById('ganhosMes').textContent = formatCurrency(data.ganhosMes);
        document.getElementById('gastosMes').textContent = formatCurrency(data.gastosMes);
        document.getElementById('saldoAtual').textContent = formatCurrency(data.saldoAtual);
    } catch (error) {
        console.error(error);
    }
}

async function fetchUltimasMovimentacoes() {
    try {
        const response = await fetchWithAuth('/api/dashboard/ultimas-movimentacoes');
        if (!response.ok) throw new Error('Erro ao buscar movimentações');
        const movimentacoes = await response.json();
        
        const tbody = document.getElementById('listaUltimasMovimentacoes');
        tbody.innerHTML = '';

        if (movimentacoes.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 1rem;">Nenhuma movimentação recente.</td></tr>`;
            return;
        }

        movimentacoes.forEach(mov => {
            const row = document.createElement('tr');
            const tipoClass = mov.tipo === 'ganho' ? 'type-ganho' : 'type-gasto';
            const dataFormatada = new Date(mov.data).toLocaleDateString('pt-BR', {timeZone: 'UTC'});
            row.innerHTML = `
                <td data-label="Data">${dataFormatada}</td>
                <td data-label="Tipo" class="capitalize ${tipoClass}">${mov.tipo}</td>
                <td data-label="Descrição">${mov.descricao}</td>
                <td data-label="Valor" class="${tipoClass}">${formatCurrency(mov.valor)}</td>
                <td data-label="Categoria" class="capitalize">${mov.categoria || '-'}</td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error(error);
    }
}

async function fetchHistoricoMovimentacoes() {
    try {
        const response = await fetchWithAuth('/api/dashboard/historico-movimentacoes');
        if (!response.ok) throw new Error('Erro ao buscar histórico');
        const data = await response.json();
        renderLineChart('movimentacoesChart', data.labels, data.datasets.ganhos, data.datasets.gastos);
    } catch (error) {
        console.error(error);
    }
}

async function fetchGastosPorCategoria() {
    try {
        const response = await fetchWithAuth('/api/dashboard/gastos-por-categoria');
        if (!response.ok) throw new Error('Erro ao buscar gastos por categoria');
        const data = await response.json();
        renderPieChart('gastosCategoriaChart', data.labels, data.datasets[0].data);
    } catch (error) {
        console.error(error);
    }
}

let chartInstances = {};

function renderLineChart(canvasId, labels, incomes, expenses) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    if (chartInstances[canvasId]) chartInstances[canvasId].destroy();
    
    chartInstances[canvasId] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Ganhos',
                data: incomes,
                borderColor: '#48bb78',
                backgroundColor: 'rgba(72, 187, 120, 0.2)',
                fill: true,
                tension: 0.3
            }, {
                label: 'Gastos',
                data: expenses,
                borderColor: '#f56565',
                backgroundColor: 'rgba(245, 101, 101, 0.2)',
                fill: true,
                tension: 0.3
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
    });
}

function renderPieChart(canvasId, labels, values) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    if (chartInstances[canvasId]) chartInstances[canvasId].destroy();

    chartInstances[canvasId] = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: ['#4299e1', '#f6ad55', '#48bb78', '#ed8936', '#a0aec0', '#ecc94b', '#9f7aea', '#ed64a6'],
                hoverOffset: 4
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}