import { getUserName, getToken, logout, fetchWithAuth, formatCurrency, getUserRole } from './auth.js';

let expensesByCategoryChartInstance;
let monthlyComparisonChartInstance;

document.addEventListener('DOMContentLoaded', () => {
    if (!getToken()) {
        logout();
        return;
    }

    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) {
        logoutButton.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    }
    
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

    const applyFilterBtn = document.getElementById('applyFilterBtn');
    if (applyFilterBtn) {
        applyFilterBtn.addEventListener('click', loadRelatorioData);
    }

    loadRelatorioData();
});

async function loadRelatorioData() {
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    
    const totalReceitasSpan = document.getElementById('totalReceitas');
    const totalDespesasSpan = document.getElementById('totalDespesas');
    const saldoRelatorioSpan = document.getElementById('saldoRelatorio');
    const topDespesasList = document.getElementById('topDespesasList');

    if (!totalReceitasSpan || !totalDespesasSpan || !saldoRelatorioSpan || !topDespesasList) {
        return;
    }
    
    totalReceitasSpan.textContent = 'Carregando...';
    totalDespesasSpan.textContent = 'Carregando...';
    saldoRelatorioSpan.textContent = 'Carregando...';
    topDespesasList.innerHTML = '<li>Carregando...</li>';

    const params = new URLSearchParams();
    if (startDateInput?.value) {
        params.append('startDate', startDateInput.value);
    }
    if (endDateInput?.value) {
        params.append('endDate', endDateInput.value);
    }
    const queryString = params.toString();
    const url = `/api/relatorios${queryString ? '?' + queryString : ''}`;

    try {
        const response = await fetchWithAuth(url);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Falha ao carregar dados do relatório.' }));
            throw new Error(errorData.message);
        }
        const data = await response.json();

        totalReceitasSpan.textContent = formatCurrency(data.totalReceitas);
        totalDespesasSpan.textContent = formatCurrency(data.totalDespesas);
        saldoRelatorioSpan.textContent = formatCurrency(data.saldo);

        topDespesasList.innerHTML = '';
        if (data.topDespesas && data.topDespesas.length > 0) {
            data.topDespesas.forEach(item => {
                const li = document.createElement('li');
                li.textContent = `${item.descricao}: ${formatCurrency(item.total_gasto)}`;
                topDespesasList.appendChild(li);
            });
        } else {
            topDespesasList.innerHTML = '<li>Nenhuma despesa principal para mostrar no período.</li>';
        }

        renderExpensesByCategoryChart(data.expensesByCategory || {});
        renderMonthlyComparisonChart(data.monthlyComparisonData || []);

    } catch (error) {
        if(topDespesasList) topDespesasList.innerHTML = `<li>Erro ao carregar dados.</li>`;
        alert(`Erro ao carregar relatórios: ${error.message}`);
    }
}

function renderExpensesByCategoryChart(expensesData) {
    const canvasId = 'despesasChart';
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;
    if (expensesByCategoryChartInstance) expensesByCategoryChartInstance.destroy();
    
    const labels = Object.keys(expensesData);
    const dataValues = Object.values(expensesData);

    if (labels.length === 0) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.font = "16px Arial";
        ctx.textAlign = "center";
        ctx.fillText("Sem dados de despesas para exibir.", ctx.canvas.width / 2, ctx.canvas.height / 2);
        return;
    }

    expensesByCategoryChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: dataValues,
                backgroundColor: ['#f56565', '#ed8936', '#ecc94b', '#48bb78', '#4299e1', '#9f7aea'],
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { tooltip: { callbacks: { label: (context) => `${context.label}: ${formatCurrency(context.raw)}` } } }
        }
    });
}

function renderMonthlyComparisonChart(monthlyData) {
    const canvasId = 'receitasDespesasChart';
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;
    if (monthlyComparisonChartInstance) monthlyComparisonChartInstance.destroy();

    if (!monthlyData || monthlyData.length === 0) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.font = "16px Arial";
        ctx.textAlign = "center";
        ctx.fillText("Sem dados de comparação mensal para exibir.", ctx.canvas.width / 2, ctx.canvas.height / 2);
        return;
    }
    
    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const labels = monthlyData.map(d => {
        const [year, month] = d.month.split('-');
        return `${monthNames[parseInt(month) - 1]}/${year.substring(2)}`;
    });
    const receitas = monthlyData.map(d => d.receitas);
    const despesas = monthlyData.map(d => d.despesas);

    monthlyComparisonChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                { label: 'Receitas', data: receitas, backgroundColor: 'rgba(72, 187, 120, 0.7)' },
                { label: 'Despesas', data: despesas, backgroundColor: 'rgba(245, 101, 101, 0.7)' }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { tooltip: { callbacks: { label: (context) => `${context.dataset.label}: ${formatCurrency(context.parsed.y)}` } } },
            scales: { y: { beginAtZero: true, ticks: { callback: value => formatCurrency(value) } } }
        }
    });
}