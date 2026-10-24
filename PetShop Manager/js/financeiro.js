// ==========================================
// PetShop Manager - Financeiro (financeiro.js)
// Gestão de receitas, despesas, KPIs e gráficos
// ==========================================

// Variáveis de estado global da página
let currentFinanceTab = 'tab-resumo';
let chartReceitasDespesasInstance = null;
let chartDespesasCategoriaInstance = null;

// Estados de paginação e filtros
let receitasPage = 1;
const receitasPerPage = 10;
let despesasPage = 1;
const despesasPerPage = 10;

// ==========================================
// INICIALIZAÇÃO
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // Sincronizar receitas automáticas (vendas e agendamentos concluídos)
    syncAutoRevenues();

    // Carregar categorias no select do modal e no filtro
    loadExpenseCategories();

    // Configurar datas padrão no filtro de resumo
    initResumoDates();

    // Renderizar aba ativa inicial (Resumo)
    renderResumoTab();

    // Renderizar tabelas iniciais
    renderReceitasTable();
    renderDespesasTable();

    // Inicializar ícones Lucide
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
});

// ==========================================
// SINCRONIZAÇÃO DE RECEITAS
// ==========================================
/**
 * Garante que vendas registradas e agendamentos concluídos estejam
 * devidamente refletidos no banco de dados de receitas (ps_revenues).
 */
function syncAutoRevenues() {
    let revenues = DB.get(STORAGE_KEYS.REVENUES) || [];
    const sales = DB.get(STORAGE_KEYS.SALES) || [];
    const appointments = DB.get(STORAGE_KEYS.APPOINTMENTS) || [];
    const clients = DB.get(STORAGE_KEYS.CLIENTS) || [];

    let hasChanges = false;
    const existingRefs = new Set(revenues.map(r => r.referencia).filter(Boolean));

    // 1. Sincronizar vendas de produtos
    sales.forEach(sale => {
        if (!existingRefs.has(sale.id)) {
            const client = clients.find(c => c.id === sale.clienteId);
            const clientName = client ? client.nome : 'Cliente Balcão';
            revenues.push({
                id: DB.generateId(),
                data: sale.data || new Date().toISOString().split('T')[0],
                descricao: `Venda #${sale.id.slice(-4)} - ${clientName}`,
                categoria: 'Produto',
                valor: Number(sale.total) || 0,
                formaPagamento: sale.formaPagamento || 'Pix',
                referencia: sale.id
            });
            existingRefs.add(sale.id);
            hasChanges = true;
        }
    });

    // 2. Sincronizar serviços concluídos
    appointments.forEach(apt => {
        if (apt.status === 'concluido' && !existingRefs.has(apt.id)) {
            const client = clients.find(c => c.id === apt.clienteId);
            const clientName = client ? client.nome : 'Cliente';
            revenues.push({
                id: DB.generateId(),
                data: apt.data || new Date().toISOString().split('T')[0],
                descricao: `${apt.servico} - ${clientName}`,
                categoria: 'Serviço',
                valor: Number(apt.valor) || 0,
                formaPagamento: 'Dinheiro', // Padrão se não registrado
                referencia: apt.id
            });
            existingRefs.add(apt.id);
            hasChanges = true;
        }
    });

    if (hasChanges) {
        DB.save(STORAGE_KEYS.REVENUES, revenues);
    }
}

// ==========================================
// CONTROLE DE ABAS
// ==========================================
function switchFinanceTab(tabId) {
    currentFinanceTab = tabId;

    // Atualizar botões de abas
    document.querySelectorAll('.tabs .tab-btn').forEach(btn => {
        if (btn.getAttribute('data-tab') === tabId) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Atualizar painéis
    document.querySelectorAll('.tab-pane').forEach(pane => {
        if (pane.id === tabId) {
            pane.classList.add('active');
        } else {
            pane.classList.remove('active');
        }
    });

    // Executar renderização correspondente
    if (tabId === 'tab-resumo') {
        renderResumoTab();
    } else if (tabId === 'tab-receitas') {
        renderReceitasTable();
    } else if (tabId === 'tab-despesas') {
        renderDespesasTable();
    }

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// ==========================================
// ABA 1: RESUMO FINANCEIRO E KPIS
// ==========================================
function initResumoDates() {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const inputInicio = document.getElementById('resumo-data-inicio');
    const inputFim = document.getElementById('resumo-data-fim');
    if (inputInicio) inputInicio.value = firstDay.toISOString().split('T')[0];
    if (inputFim) inputFim.value = lastDay.toISOString().split('T')[0];
}

function onResumoPeriodChange() {
    const periodo = document.getElementById('resumo-periodo').value;
    const customDiv = document.getElementById('resumo-custom-dates');
    if (customDiv) {
        customDiv.style.display = periodo === 'personalizado' ? 'inline-flex' : 'none';
    }
    renderResumoTab();
}

/**
 * Retorna as datas [inicio, fim] conforme a opção de período
 */
function getPeriodoRange(tipo, customStartId, customEndId) {
    const today = new Date();
    let startDate = null;
    let endDate = null;
    let label = '';

    switch (tipo) {
        case 'mes_atual': {
            startDate = new Date(today.getFullYear(), today.getMonth(), 1);
            endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            const mesNome = startDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
            label = mesNome.charAt(0).toUpperCase() + mesNome.slice(1);
            break;
        }
        case 'mes_anterior': {
            startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            endDate = new Date(today.getFullYear(), today.getMonth(), 0);
            const mesNome = startDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
            label = mesNome.charAt(0).toUpperCase() + mesNome.slice(1);
            break;
        }
        case 'ultimos_30': {
            endDate = new Date(today);
            startDate = new Date(today);
            startDate.setDate(today.getDate() - 30);
            label = 'Últimos 30 dias';
            break;
        }
        case 'ultimos_90': {
            endDate = new Date(today);
            startDate = new Date(today);
            startDate.setDate(today.getDate() - 90);
            label = 'Últimos 90 dias';
            break;
        }
        case 'ano_atual': {
            startDate = new Date(today.getFullYear(), 0, 1);
            endDate = new Date(today.getFullYear(), 11, 31);
            label = `Ano de ${today.getFullYear()}`;
            break;
        }
        case 'personalizado': {
            const elStart = document.getElementById(customStartId);
            const elEnd = document.getElementById(customEndId);
            if (elStart && elStart.value) startDate = new Date(elStart.value + 'T00:00:00');
            if (elEnd && elEnd.value) endDate = new Date(elEnd.value + 'T23:59:59');
            label = `${startDate ? formatDate(startDate.toISOString().split('T')[0]) : 'Início'} até ${endDate ? formatDate(endDate.toISOString().split('T')[0]) : 'Hoje'}`;
            break;
        }
        case 'todos':
        default: {
            startDate = null;
            endDate = null;
            label = 'Todo o Histórico';
            break;
        }
    }

    return { startDate, endDate, label };
}

function renderResumoTab() {
    const periodo = document.getElementById('resumo-periodo') ? document.getElementById('resumo-periodo').value : 'mes_atual';
    const { startDate, endDate, label } = getPeriodoRange(periodo, 'resumo-data-inicio', 'resumo-data-fim');

    const badgeTexto = document.getElementById('resumo-periodo-texto');
    if (badgeTexto) badgeTexto.textContent = label;

    const revenues = DB.get(STORAGE_KEYS.REVENUES) || [];
    const expenses = DB.get(STORAGE_KEYS.EXPENSES) || [];

    // Filtrar receitas no período
    const filteredRevenues = revenues.filter(r => {
        if (!r.data) return false;
        const d = new Date(r.data + 'T00:00:00');
        if (startDate && d < startDate) return false;
        if (endDate && d > endDate) return false;
        return true;
    });

    // Filtrar despesas no período
    const filteredExpenses = expenses.filter(e => {
        if (!e.data) return false;
        const d = new Date(e.data + 'T00:00:00');
        if (startDate && d < startDate) return false;
        if (endDate && d > endDate) return false;
        return true;
    });

    // Cálculos de Totais
    const totalReceitas = filteredRevenues.reduce((acc, cur) => acc + (Number(cur.valor) || 0), 0);
    const totalDespesas = filteredExpenses.reduce((acc, cur) => acc + (Number(cur.valor) || 0), 0);
    const lucroLiquido = totalReceitas - totalDespesas;
    const margemLucro = totalReceitas > 0 ? (lucroLiquido / totalReceitas) * 100 : 0;

    // Atualizar Stat Cards no DOM
    const elFat = document.getElementById('kpi-faturamento');
    const elDesp = document.getElementById('kpi-despesas');
    const elLucro = document.getElementById('kpi-lucro');
    const elMargem = document.getElementById('kpi-margem');
    const cardLucro = document.getElementById('card-lucro-liquido');

    if (elFat) elFat.textContent = formatCurrency(totalReceitas);
    if (elDesp) elDesp.textContent = formatCurrency(totalDespesas);
    if (elLucro) {
        elLucro.textContent = formatCurrency(lucroLiquido);
        if (lucroLiquido >= 0) {
            elLucro.className = 'stat-value text-success';
            if (cardLucro) cardLucro.className = 'stat-card success';
        } else {
            elLucro.className = 'stat-value text-danger';
            if (cardLucro) cardLucro.className = 'stat-card danger';
        }
    }
    if (elMargem) {
        elMargem.textContent = `${margemLucro.toFixed(1).replace('.', ',')}%`;
    }

    // Renderizar Gráficos
    renderChartReceitasDespesas(revenues, expenses);
    renderChartDespesasCategoria(filteredExpenses);
}

// Gráfico de Barras: Comparativo mensal (Últimos 6 meses)
function renderChartReceitasDespesas(allRevenues, allExpenses) {
    const canvas = document.getElementById('chartReceitasDespesas');
    if (!canvas) return;

    // Gerar rótulos para os últimos 6 meses
    const months = [];
    const today = new Date();
    for (let i = 5; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        months.push({
            year: d.getFullYear(),
            month: d.getMonth(),
            key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
            label: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase()
        });
    }

    const receitasData = months.map(m => {
        return allRevenues
            .filter(r => r.data && r.data.startsWith(m.key))
            .reduce((acc, cur) => acc + (Number(cur.valor) || 0), 0);
    });

    const despesasData = months.map(m => {
        return allExpenses
            .filter(e => e.data && e.data.startsWith(m.key))
            .reduce((acc, cur) => acc + (Number(cur.valor) || 0), 0);
    });

    if (chartReceitasDespesasInstance) {
        chartReceitasDespesasInstance.destroy();
    }

    const ctx = canvas.getContext('2d');
    chartReceitasDespesasInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: months.map(m => m.label),
            datasets: [
                {
                    label: 'Receitas (R$)',
                    data: receitasData,
                    backgroundColor: '#5BA4E6',
                    borderRadius: 6,
                    borderSkipped: false
                },
                {
                    label: 'Despesas (R$)',
                    data: despesasData,
                    backgroundColor: '#E74C6F',
                    borderRadius: 6,
                    borderSkipped: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: { font: { family: 'Inter', size: 12 }, boxWidth: 14 }
                },
                tooltip: {
                    callbacks: {
                        label: function (ctx) {
                            return ` ${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function (val) {
                            return 'R$ ' + val.toLocaleString('pt-BR');
                        }
                    }
                }
            }
        }
    });
}

// Gráfico de Rosca: Despesas por Categoria
function renderChartDespesasCategoria(expenses) {
    const canvas = document.getElementById('chartDespesasCategoria');
    if (!canvas) return;

    const catTotals = {};
    expenses.forEach(e => {
        const cat = e.categoria || 'Outros';
        catTotals[cat] = (catTotals[cat] || 0) + (Number(e.valor) || 0);
    });

    const labels = Object.keys(catTotals);
    const data = Object.values(catTotals);

    if (chartDespesasCategoriaInstance) {
        chartDespesasCategoriaInstance.destroy();
    }

    if (labels.length === 0) {
        // Se vazio, exibir dados zerados para feedback visual
        labels.push('Sem Despesas');
        data.push(1);
    }

    const palette = ['#E74C6F', '#F5A623', '#5BA4E6', '#4CAF82', '#9C27B0', '#00BCD4', '#795548'];

    const ctx = canvas.getContext('2d');
    chartDespesasCategoriaInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: palette.slice(0, labels.length),
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: { font: { family: 'Inter', size: 11 }, boxWidth: 12 }
                },
                tooltip: {
                    callbacks: {
                        label: function (ctx) {
                            if (ctx.label === 'Sem Despesas') return ' Nenhuma despesa no período';
                            return ` ${ctx.label}: ${formatCurrency(ctx.parsed)}`;
                        }
                    }
                }
            },
            cutout: '65%'
        }
    });
}

// ==========================================
// ABA 2: RECEITAS
// ==========================================
function onFilterReceitas() {
    receitasPage = 1;
    renderReceitasTable();
}

function clearReceitasFilters() {
    const elSearch = document.getElementById('rec-search');
    const elCat = document.getElementById('rec-categoria');
    const elPag = document.getElementById('rec-pagamento');
    const elDataIni = document.getElementById('rec-data-inicio');
    const elDataFim = document.getElementById('rec-data-fim');

    if (elSearch) elSearch.value = '';
    if (elCat) elCat.value = '';
    if (elPag) elPag.value = '';
    if (elDataIni) elDataIni.value = '';
    if (elDataFim) elDataFim.value = '';

    receitasPage = 1;
    renderReceitasTable();
}

function changeReceitasPage(page) {
    receitasPage = page;
    renderReceitasTable();
}

function renderReceitasTable() {
    const tbody = document.getElementById('rec-table-body');
    if (!tbody) return;

    let revenues = DB.get(STORAGE_KEYS.REVENUES) || [];

    // Obter valores de filtros
    const search = (document.getElementById('rec-search')?.value || '').toLowerCase().trim();
    const categoria = document.getElementById('rec-categoria')?.value || '';
    const formaPgto = document.getElementById('rec-pagamento')?.value || '';
    const dataInicio = document.getElementById('rec-data-inicio')?.value || '';
    const dataFim = document.getElementById('rec-data-fim')?.value || '';

    // Aplicar filtros
    let filtered = revenues.filter(item => {
        if (search) {
            const matchDesc = (item.descricao || '').toLowerCase().includes(search);
            const matchRef = (item.referencia || '').toLowerCase().includes(search);
            const matchForma = (item.formaPagamento || '').toLowerCase().includes(search);
            if (!matchDesc && !matchRef && !matchForma) return false;
        }
        if (categoria && item.categoria !== categoria) return false;
        if (formaPgto && item.formaPagamento !== formaPgto) return false;
        if (dataInicio && item.data < dataInicio) return false;
        if (dataFim && item.data > dataFim) return false;
        return true;
    });

    // Ordenar da data mais recente para a mais antiga
    filtered.sort((a, b) => new Date(b.data || 0) - new Date(a.data || 0));

    // Atualizar sumário do cabeçalho da tabela
    const totalValor = filtered.reduce((acc, cur) => acc + (Number(cur.valor) || 0), 0);
    const countBadge = document.getElementById('rec-total-count');
    const valorBadge = document.getElementById('rec-total-valor');
    if (countBadge) countBadge.textContent = `${filtered.length} registro(s)`;
    if (valorBadge) valorBadge.textContent = formatCurrency(totalValor);

    // Paginação
    const paginated = paginate(filtered, receitasPage, receitasPerPage);
    receitasPage = paginated.currentPage;

    if (paginated.data.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5">
                    <div class="empty-state">
                        <i data-lucide="inbox"></i>
                        <p>Nenhuma receita encontrada</p>
                        <span>Ajuste os filtros ou registre novas vendas/serviços.</span>
                    </div>
                </td>
            </tr>
        `;
    } else {
        tbody.innerHTML = paginated.data.map(item => {
            const isProd = item.categoria === 'Produto';
            const catBadgeClass = isProd ? 'badge-info' : 'badge-warning';
            const catIcon = isProd ? 'shopping-bag' : 'scissors';

            return `
                <tr>
                    <td><strong style="color: var(--text-primary);">${formatDate(item.data)}</strong></td>
                    <td>
                        <div style="font-weight: 500; color: var(--text-primary);">${item.descricao || 'Receita'}</div>
                        ${item.referencia ? `<span style="font-size: 0.75rem; color: var(--text-light);">Ref: ${item.referencia}</span>` : ''}
                    </td>
                    <td>
                        <span class="badge ${catBadgeClass}">
                            <i data-lucide="${catIcon}" style="width: 12px; height: 12px; margin-right: 4px;"></i>
                            ${item.categoria || 'Outro'}
                        </span>
                    </td>
                    <td>
                        <span class="badge badge-neutral">${item.formaPagamento || 'Não informada'}</span>
                    </td>
                    <td style="text-align: right; font-weight: 700; color: var(--success);">
                        + ${formatCurrency(item.valor)}
                    </td>
                </tr>
            `;
        }).join('');
    }

    // Informação de paginação e renderização dos botões
    const infoEl = document.getElementById('rec-pagination-info');
    if (infoEl) {
        const startItem = filtered.length === 0 ? 0 : (paginated.currentPage - 1) * receitasPerPage + 1;
        const endItem = Math.min(filtered.length, paginated.currentPage * receitasPerPage);
        infoEl.textContent = `Mostrando ${startItem}-${endItem} de ${filtered.length} receitas`;
    }

    renderPagination('receitas-pagination', paginated.currentPage, paginated.totalPages, 'changeReceitasPage');

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// ==========================================
// ABA 3: DESPESAS E OPERAÇÕES CRUD
// ==========================================
function loadExpenseCategories() {
    const settings = DB.get(STORAGE_KEYS.SETTINGS) || {};
    const categories = settings.categoriasDespesas || [
        'Aluguel', 'Salários', 'Fornecedores', 'Água/Luz', 'Limpeza', 'Outros'
    ];

    // Select no formulário modal
    const modalSelect = document.getElementById('despesa-categoria');
    if (modalSelect) {
        modalSelect.innerHTML = categories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
    }

    // Select no filtro da tabela
    const filterSelect = document.getElementById('desp-categoria');
    if (filterSelect) {
        filterSelect.innerHTML = '<option value="">Todas as Categorias</option>' +
            categories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
    }
}

function onFilterDespesas() {
    despesasPage = 1;
    renderDespesasTable();
}

function clearDespesasFilters() {
    const elSearch = document.getElementById('desp-search');
    const elCat = document.getElementById('desp-categoria');
    const elRec = document.getElementById('desp-recorrente');
    const elDataIni = document.getElementById('desp-data-inicio');
    const elDataFim = document.getElementById('desp-data-fim');

    if (elSearch) elSearch.value = '';
    if (elCat) elCat.value = '';
    if (elRec) elRec.value = '';
    if (elDataIni) elDataIni.value = '';
    if (elDataFim) elDataFim.value = '';

    despesasPage = 1;
    renderDespesasTable();
}

function changeDespesasPage(page) {
    despesasPage = page;
    renderDespesasTable();
}

function renderDespesasTable() {
    const tbody = document.getElementById('desp-table-body');
    if (!tbody) return;

    let expenses = DB.get(STORAGE_KEYS.EXPENSES) || [];

    // Obter filtros
    const search = (document.getElementById('desp-search')?.value || '').toLowerCase().trim();
    const categoria = document.getElementById('desp-categoria')?.value || '';
    const recorrente = document.getElementById('desp-recorrente')?.value || '';
    const dataInicio = document.getElementById('desp-data-inicio')?.value || '';
    const dataFim = document.getElementById('desp-data-fim')?.value || '';

    // Filtrar despesas
    let filtered = expenses.filter(item => {
        if (search && !(item.descricao || '').toLowerCase().includes(search)) return false;
        if (categoria && item.categoria !== categoria) return false;
        if (recorrente === 'recorrente' && !item.recorrente) return false;
        if (recorrente === 'pontual' && item.recorrente) return false;
        if (dataInicio && item.data < dataInicio) return false;
        if (dataFim && item.data > dataFim) return false;
        return true;
    });

    // Ordenar da mais recente para a mais antiga
    filtered.sort((a, b) => new Date(b.data || 0) - new Date(a.data || 0));

    // Sumário do topo da tabela
    const totalValor = filtered.reduce((acc, cur) => acc + (Number(cur.valor) || 0), 0);
    const countBadge = document.getElementById('desp-total-count');
    const valorBadge = document.getElementById('desp-total-valor');
    if (countBadge) countBadge.textContent = `${filtered.length} despesa(s)`;
    if (valorBadge) valorBadge.textContent = formatCurrency(totalValor);

    // Paginação
    const paginated = paginate(filtered, despesasPage, despesasPerPage);
    despesasPage = paginated.currentPage;

    if (paginated.data.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6">
                    <div class="empty-state">
                        <i data-lucide="receipt"></i>
                        <p>Nenhuma despesa cadastrada</p>
                        <span>Clique em "+ Nova Despesa" para cadastrar pagamentos e custos.</span>
                    </div>
                </td>
            </tr>
        `;
    } else {
        tbody.innerHTML = paginated.data.map(item => {
            const isRec = Boolean(item.recorrente);
            return `
                <tr>
                    <td><strong style="color: var(--text-primary);">${formatDate(item.data)}</strong></td>
                    <td>
                        <span style="font-weight: 500; color: var(--text-primary);">${item.descricao || 'Despesa'}</span>
                    </td>
                    <td>
                        <span class="badge badge-neutral">${item.categoria || 'Geral'}</span>
                    </td>
                    <td style="text-align: center;">
                        ${isRec 
                            ? `<span class="badge badge-info" title="Despesa recorrente mensal"><i data-lucide="repeat" style="width: 12px; height: 12px; margin-right: 4px;"></i> Mensal</span>`
                            : `<span style="color: var(--text-light); font-size: 0.85rem;">Pontual</span>`
                        }
                    </td>
                    <td style="text-align: right; font-weight: 700; color: var(--danger);">
                        - ${formatCurrency(item.valor)}
                    </td>
                    <td>
                        <div class="table-actions" style="justify-content: center;">
                            <button class="btn-icon" title="Editar Despesa" onclick="openExpenseModal('${item.id}')">
                                <i data-lucide="edit-2"></i>
                            </button>
                            <button class="btn-icon" style="color: var(--danger);" title="Excluir Despesa" onclick="deleteExpense('${item.id}')">
                                <i data-lucide="trash-2"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // Informação de paginação e renderização
    const infoEl = document.getElementById('desp-pagination-info');
    if (infoEl) {
        const startItem = filtered.length === 0 ? 0 : (paginated.currentPage - 1) * despesasPerPage + 1;
        const endItem = Math.min(filtered.length, paginated.currentPage * despesasPerPage);
        infoEl.textContent = `Mostrando ${startItem}-${endItem} de ${filtered.length} despesas`;
    }

    renderPagination('despesas-pagination', paginated.currentPage, paginated.totalPages, 'changeDespesasPage');

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// ==========================================
// MODAL & CRUD DE DESPESAS
// ==========================================
function openExpenseModal(expenseId = null) {
    const form = document.getElementById('form-despesa');
    if (!form) return;

    form.reset();
    document.getElementById('despesa-id').value = '';

    const titleEl = document.getElementById('modal-despesa-titulo');
    const saveBtn = document.getElementById('btn-salvar-despesa');

    if (expenseId) {
        const expenses = DB.get(STORAGE_KEYS.EXPENSES) || [];
        const item = expenses.find(e => e.id === expenseId);
        if (item) {
            document.getElementById('despesa-id').value = item.id;
            document.getElementById('despesa-descricao').value = item.descricao || '';
            document.getElementById('despesa-categoria').value = item.categoria || '';
            document.getElementById('despesa-valor').value = item.valor || '';
            document.getElementById('despesa-data').value = item.data || '';
            document.getElementById('despesa-recorrente').checked = Boolean(item.recorrente);

            if (titleEl) titleEl.textContent = 'Editar Despesa';
            if (saveBtn) saveBtn.textContent = 'Salvar Alterações';
        }
    } else {
        if (titleEl) titleEl.textContent = 'Nova Despesa';
        if (saveBtn) saveBtn.textContent = 'Salvar Despesa';
        // Data atual como padrão
        document.getElementById('despesa-data').value = new Date().toISOString().split('T')[0];
    }

    openModal('modal-despesa');
}

function saveExpense(event) {
    event.preventDefault();

    const id = document.getElementById('despesa-id').value;
    const descricao = document.getElementById('despesa-descricao').value.trim();
    const categoria = document.getElementById('despesa-categoria').value;
    const valor = parseFloat(document.getElementById('despesa-valor').value);
    const data = document.getElementById('despesa-data').value;
    const recorrente = document.getElementById('despesa-recorrente').checked;

    if (!descricao || isNaN(valor) || valor <= 0 || !data) {
        showToast('Preencha todos os campos obrigatórios corretamente.', 'warning');
        return;
    }

    let expenses = DB.get(STORAGE_KEYS.EXPENSES) || [];

    if (id) {
        // Atualização de despesa existente
        const index = expenses.findIndex(e => e.id === id);
        if (index !== -1) {
            expenses[index] = {
                ...expenses[index],
                descricao,
                categoria,
                valor,
                data,
                recorrente
            };
            showToast('Despesa atualizada com sucesso!', 'success');
        }
    } else {
        // Nova despesa
        const newExpense = {
            id: DB.generateId(),
            descricao,
            categoria,
            valor,
            data,
            recorrente
        };
        expenses.unshift(newExpense);
        showToast('Despesa cadastrada com sucesso!', 'success');
    }

    DB.save(STORAGE_KEYS.EXPENSES, expenses);
    closeModal('modal-despesa');

    // Atualizar visualizações
    renderDespesasTable();
    if (currentFinanceTab === 'tab-resumo') {
        renderResumoTab();
    }
}

async function deleteExpense(expenseId) {
    const confirmed = await confirmDialog('Tem certeza que deseja excluir esta despesa? Esta ação não pode ser desfeita.');
    if (!confirmed) return;

    let expenses = DB.get(STORAGE_KEYS.EXPENSES) || [];
    expenses = expenses.filter(e => e.id !== expenseId);
    DB.save(STORAGE_KEYS.EXPENSES, expenses);

    showToast('Despesa removida com sucesso.', 'info');
    renderDespesasTable();
    renderResumoTab();
}

// ==========================================
// EXPORTAÇÃO E IMPRESSÃO
// ==========================================
function exportFinanceReport() {
    const revenues = DB.get(STORAGE_KEYS.REVENUES) || [];
    const expenses = DB.get(STORAGE_KEYS.EXPENSES) || [];
    const settings = DB.get(STORAGE_KEYS.SETTINGS) || {};

    const periodo = document.getElementById('resumo-periodo') ? document.getElementById('resumo-periodo').value : 'mes_atual';
    const { startDate, endDate, label } = getPeriodoRange(periodo, 'resumo-data-inicio', 'resumo-data-fim');

    // Filtrar dados para o relatório impresso
    const filteredRevenues = revenues.filter(r => {
        if (!r.data) return false;
        const d = new Date(r.data + 'T00:00:00');
        if (startDate && d < startDate) return false;
        if (endDate && d > endDate) return false;
        return true;
    });

    const filteredExpenses = expenses.filter(e => {
        if (!e.data) return false;
        const d = new Date(e.data + 'T00:00:00');
        if (startDate && d < startDate) return false;
        if (endDate && d > endDate) return false;
        return true;
    });

    const totalReceitas = filteredRevenues.reduce((acc, cur) => acc + (Number(cur.valor) || 0), 0);
    const totalDespesas = filteredExpenses.reduce((acc, cur) => acc + (Number(cur.valor) || 0), 0);
    const lucroLiquido = totalReceitas - totalDespesas;
    const margem = totalReceitas > 0 ? (lucroLiquido / totalReceitas) * 100 : 0;

    const printContainer = document.getElementById('print-area');
    if (!printContainer) return;

    printContainer.innerHTML = `
        <div style="font-family: var(--font-body); color: #1E3A5F; padding: 1rem;">
            <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #5BA4E6; padding-bottom: 1rem; margin-bottom: 1.5rem;">
                <div>
                    <h2 style="font-size: 1.4rem; color: #1E3A5F; margin-bottom: 0.25rem;">${settings.nomeFantasia || 'PetShop Manager'}</h2>
                    <p style="font-size: 0.85rem; color: #5a6f85;">CNPJ: ${settings.cnpj || 'Não informado'} | Tel: ${settings.telefone || ''}</p>
                </div>
                <div style="text-align: right;">
                    <h3 style="font-size: 1.15rem; color: #5BA4E6;">Relatório Financeiro</h3>
                    <p style="font-size: 0.85rem; color: #5a6f85;">Período: <strong>${label}</strong></p>
                    <p style="font-size: 0.75rem; color: #8a9bb5;">Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
            </div>

            <!-- Resumo dos Indicadores -->
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.5rem;">
                <div style="background: #f8fafe; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.85rem; text-align: center;">
                    <div style="font-size: 0.75rem; color: #5a6f85; text-transform: uppercase;">Faturamento Bruto</div>
                    <div style="font-size: 1.25rem; font-weight: 700; color: #5BA4E6; margin-top: 0.25rem;">${formatCurrency(totalReceitas)}</div>
                </div>
                <div style="background: #f8fafe; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.85rem; text-align: center;">
                    <div style="font-size: 0.75rem; color: #5a6f85; text-transform: uppercase;">Total Despesas</div>
                    <div style="font-size: 1.25rem; font-weight: 700; color: #E74C6F; margin-top: 0.25rem;">${formatCurrency(totalDespesas)}</div>
                </div>
                <div style="background: #f8fafe; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.85rem; text-align: center;">
                    <div style="font-size: 0.75rem; color: #5a6f85; text-transform: uppercase;">Lucro Líquido</div>
                    <div style="font-size: 1.25rem; font-weight: 700; color: ${lucroLiquido >= 0 ? '#4CAF82' : '#E74C6F'}; margin-top: 0.25rem;">${formatCurrency(lucroLiquido)}</div>
                </div>
                <div style="background: #f8fafe; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.85rem; text-align: center;">
                    <div style="font-size: 0.75rem; color: #5a6f85; text-transform: uppercase;">Margem Operacional</div>
                    <div style="font-size: 1.25rem; font-weight: 700; color: #D4A84B; margin-top: 0.25rem;">${margem.toFixed(1).replace('.', ',')}%</div>
                </div>
            </div>

            <!-- Tabela Resumo de Receitas Recentes -->
            <h4 style="font-size: 0.95rem; margin-bottom: 0.5rem; color: #1E3A5F; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.25rem;">
                Últimas Receitas (${filteredRevenues.length} registros)
            </h4>
            <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem; margin-bottom: 1.5rem;">
                <thead>
                    <tr style="background: #f8fafe; text-align: left; border-bottom: 1px solid #e2e8f0;">
                        <th style="padding: 0.4rem;">Data</th>
                        <th style="padding: 0.4rem;">Descrição</th>
                        <th style="padding: 0.4rem;">Categoria</th>
                        <th style="padding: 0.4rem;">Pagamento</th>
                        <th style="padding: 0.4rem; text-align: right;">Valor</th>
                    </tr>
                </thead>
                <tbody>
                    ${filteredRevenues.slice(0, 10).map(r => `
                        <tr style="border-bottom: 1px solid #f0f4f8;">
                            <td style="padding: 0.4rem;">${formatDate(r.data)}</td>
                            <td style="padding: 0.4rem;">${r.descricao || '-'}</td>
                            <td style="padding: 0.4rem;">${r.categoria}</td>
                            <td style="padding: 0.4rem;">${r.formaPagamento}</td>
                            <td style="padding: 0.4rem; text-align: right; font-weight: 600;">${formatCurrency(r.valor)}</td>
                        </tr>
                    `).join('')}
                    ${filteredRevenues.length > 10 ? `<tr><td colspan="5" style="padding: 0.4rem; text-align: center; color: #8a9bb5;">... e mais ${filteredRevenues.length - 10} receitas</td></tr>` : ''}
                </tbody>
            </table>

            <!-- Tabela Resumo de Despesas Recentes -->
            <h4 style="font-size: 0.95rem; margin-bottom: 0.5rem; color: #1E3A5F; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.25rem;">
                Últimas Despesas (${filteredExpenses.length} registros)
            </h4>
            <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem; margin-bottom: 1.5rem;">
                <thead>
                    <tr style="background: #f8fafe; text-align: left; border-bottom: 1px solid #e2e8f0;">
                        <th style="padding: 0.4rem;">Data</th>
                        <th style="padding: 0.4rem;">Descrição</th>
                        <th style="padding: 0.4rem;">Categoria</th>
                        <th style="padding: 0.4rem;">Tipo</th>
                        <th style="padding: 0.4rem; text-align: right;">Valor</th>
                    </tr>
                </thead>
                <tbody>
                    ${filteredExpenses.slice(0, 10).map(e => `
                        <tr style="border-bottom: 1px solid #f0f4f8;">
                            <td style="padding: 0.4rem;">${formatDate(e.data)}</td>
                            <td style="padding: 0.4rem;">${e.descricao || '-'}</td>
                            <td style="padding: 0.4rem;">${e.categoria}</td>
                            <td style="padding: 0.4rem;">${e.recorrente ? 'Recorrente' : 'Pontual'}</td>
                            <td style="padding: 0.4rem; text-align: right; font-weight: 600; color: #E74C6F;">${formatCurrency(e.valor)}</td>
                        </tr>
                    `).join('')}
                    ${filteredExpenses.length > 10 ? `<tr><td colspan="5" style="padding: 0.4rem; text-align: center; color: #8a9bb5;">... e mais ${filteredExpenses.length - 10} despesas</td></tr>` : ''}
                </tbody>
            </table>
        </div>
    `;

    openModal('modal-imprimir-financeiro');
}
