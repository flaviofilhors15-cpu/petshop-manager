// ==========================================
// PetShop Manager - Módulo de Estoque (estoque.js)
// Gestão Completa de Inventário, Validades,
// Lista de Compras, Fracionamento e Etiquetas
// ==========================================

// Estado global da página de Estoque
const EstoqueState = {
    search: '',
    category: '',
    status: '', // '', 'ok', 'baixo', 'esgotado', 'vencendo', 'vencido'
    sortColumn: 'nome',
    sortDirection: 'asc', // 'asc' ou 'desc'
    currentPage: 1,
    perPage: 10,
    editingProductId: null
};

// === Inicialização do Módulo ===
document.addEventListener('DOMContentLoaded', () => {
    initEstoque();
});

function initEstoque() {
    garantirDadosIniciaisEstoque();
    populateEstoqueCategories();
    renderEstoqueStats();
    renderProductsTable();

    // Re-renderizar ícones Lucide
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// Garante que produtos existentes tenham unidade e alguns tenham validade para demonstração
function garantirDadosIniciaisEstoque() {
    const products = DB.get(STORAGE_KEYS.PRODUCTS) || [];
    let modified = false;

    const today = new Date();
    const daysLater = (n) => {
        const d = new Date(today);
        d.setDate(today.getDate() + n);
        return d.toISOString().split('T')[0];
    };
    const daysAgo = (n) => {
        const d = new Date(today);
        d.setDate(today.getDate() - n);
        return d.toISOString().split('T')[0];
    };

    // Verificar se algum produto tem validade cadastrada
    const temValidade = products.some(p => p.validade);

    products.forEach((p, idx) => {
        if (!p.unidade) {
            p.unidade = p.nome && p.nome.toLowerCase().includes('granel') ? 'kg' : 'un';
            modified = true;
        }

        // Se nenhum produto tiver validade, enriquecer alguns para demonstração imediata
        if (!temValidade) {
            if (p.id === 'prod_009' || p.sku === 'HIG002') {
                p.validade = daysLater(15); // Vencendo em 15 dias
                modified = true;
            } else if (p.id === 'prod_013' || p.sku === 'MED001') {
                p.validade = daysAgo(6); // Já vencido
                modified = true;
            } else if (p.id === 'prod_014' || p.sku === 'MED002') {
                p.validade = daysLater(28); // Vencendo em 28 dias
                modified = true;
            } else if (p.categoria === 'Rações' || p.categoria === 'Medicamentos' || p.categoria === 'Petiscos') {
                p.validade = daysLater(90 + (idx * 20));
                modified = true;
            }
        }
    });

    // Se não existir produto a granel, adicionar para facilitar demonstração do fracionamento
    const temGranel = products.some(p => p.unidade === 'kg' || (p.nome && p.nome.toLowerCase().includes('granel')));
    if (!temGranel && products.length > 0) {
        products.push({
            id: 'prod_granel_001',
            nome: 'Ração Premium Adulto (A Granel kg)',
            descricao: 'Ração vendida por quilo fracionada do saco de 15kg',
            categoria: 'Rações',
            sku: 'RAC-GRA01',
            precoCusto: 6.00,
            precoVenda: 12.90,
            margem: 53.49,
            estoque: 12.5,
            estoqueMinimo: 5,
            unidade: 'kg',
            validade: daysLater(60),
            fornecedor: 'PetFood Dist.',
            foto: ''
        });
        modified = true;
    }

    if (modified) {
        DB.save(STORAGE_KEYS.PRODUCTS, products);
    }

    // Garantir fornecedores parceiros cadastrados
    let suppliers = DB.get(STORAGE_KEYS.SUPPLIERS);
    if (!suppliers || suppliers.length === 0) {
        suppliers = [
            { id: 'forn_001', nome: 'PetFood Dist.', contato: 'Carlos Oliveira', telefone: '(11) 98765-4321', email: 'pedidos@petfooddist.com.br', prazoMedioDias: 7, categorias: 'Rações, Petiscos', observacoes: 'Entrega terças e quintas' },
            { id: 'forn_002', nome: 'VetFarma', contato: 'Dra. Juliana Mendes', telefone: '(11) 97123-4567', email: 'vendas@vetfarma.com.br', prazoMedioDias: 10, categorias: 'Medicamentos, Higiene', observacoes: 'Boleto 28 dias' },
            { id: 'forn_003', nome: 'PetClean', contato: 'Roberto Silva', telefone: '(19) 99234-5678', email: 'comercial@petclean.com.br', prazoMedioDias: 5, categorias: 'Higiene, Estética', observacoes: 'Pedido mín. R$ 300' },
            { id: 'forn_004', nome: 'PetComfort', contato: 'Mariana Costa', telefone: '(11) 98877-6655', email: 'contato@petcomfort.com.br', prazoMedioDias: 8, categorias: 'Acessórios, Camas', observacoes: 'Frete grátis acima de R$ 800' },
            { id: 'forn_005', nome: 'PetToys', contato: 'Lucas Silveira', telefone: '(41) 99112-3344', email: 'pedidos@pettoys.com.br', prazoMedioDias: 6, categorias: 'Brinquedos', observacoes: 'Desconto 5% no Pix' }
        ];
        DB.save(STORAGE_KEYS.SUPPLIERS, suppliers);
    }

    // Garantir pedidos de compra com prazo e em trânsito
    let purchaseOrders = DB.get(STORAGE_KEYS.PURCHASE_ORDERS);
    if (!purchaseOrders || purchaseOrders.length === 0) {
        purchaseOrders = [
            {
                id: 'po_001',
                numero: 'PED-102',
                fornecedorId: 'forn_002',
                fornecedorNome: 'VetFarma',
                fornecedorTelefone: '(11) 97123-4567',
                dataPedido: daysAgo(3),
                prazoDias: 10,
                dataPrevista: daysLater(7),
                status: 'em_transito',
                itens: [
                    { produtoId: 'prod_013', produtoNome: 'Antipulgas Comprimido', quantidade: 10, unidade: 'cx', custoUnitario: 22.00, subtotal: 220.00 }
                ],
                valorTotal: 220.00,
                formaPagamento: 'Boleto 28 dias',
                observacoes: 'Entregar na recepção',
                dataRecebimento: null
            },
            {
                id: 'po_002',
                numero: 'PED-101',
                fornecedorId: 'forn_001',
                fornecedorNome: 'PetFood Dist.',
                fornecedorTelefone: '(11) 98765-4321',
                dataPedido: daysAgo(12),
                prazoDias: 10,
                dataPrevista: daysAgo(2),
                status: 'em_transito',
                itens: [
                    { produtoId: 'prod_001', produtoNome: 'Ração Golden Special 15kg', quantidade: 8, unidade: 'un', custoUnitario: 115.00, subtotal: 920.00 }
                ],
                valorTotal: 920.00,
                formaPagamento: 'Boleto 30 dias',
                observacoes: 'Pedido urgente de reposição de ração',
                dataRecebimento: null
            }
        ];
        DB.save(STORAGE_KEYS.PURCHASE_ORDERS, purchaseOrders);
    }
}

// === Carregar Categorias no Filtro e nos Modais ===
function populateEstoqueCategories() {
    const filterSelect = document.getElementById('estoque-category-filter');
    const modalSelect = document.getElementById('product-categoria');

    const settings = DB.get(STORAGE_KEYS.SETTINGS) || {};
    const defaultCategories = ['Rações', 'Petiscos', 'Brinquedos', 'Higiene', 'Acessórios', 'Medicamentos'];
    const categories = settings.categoriasProdutos && settings.categoriasProdutos.length > 0 
        ? [...settings.categoriasProdutos] 
        : defaultCategories;

    // Incluir categorias de produtos existentes
    const products = DB.get(STORAGE_KEYS.PRODUCTS) || [];
    products.forEach(p => {
        if (p.categoria && !categories.includes(p.categoria)) {
            categories.push(p.categoria);
        }
    });

    if (filterSelect) {
        filterSelect.innerHTML = '<option value="">Todas as Categorias</option>' +
            categories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
        if (EstoqueState.category) {
            filterSelect.value = EstoqueState.category;
        }
    }

    if (modalSelect) {
        modalSelect.innerHTML = '<option value="">Selecione uma categoria...</option>' +
            categories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
    }
}

// === Helper de Cálculo de Validade ===
function getValidityInfo(validadeStr) {
    if (!validadeStr) {
        return {
            status: 'none',
            diffDays: null,
            label: '-',
            badgeHtml: '<span class="text-muted" style="font-size:0.85rem;">-</span>'
        };
    }

    const target = new Date(validadeStr + (validadeStr.includes('T') ? '' : 'T00:00:00'));
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const targetDate = new Date(target.getFullYear(), target.getMonth(), target.getDate());
    const diffDays = Math.round((targetDate - today) / (1000 * 60 * 60 * 24));
    const dataFmt = formatDate(validadeStr);

    if (diffDays < 0) {
        return {
            status: 'vencido',
            diffDays,
            label: `Vencido (${Math.abs(diffDays)}d)`,
            badgeHtml: `<span class="badge badge-expired" title="Venceu em ${dataFmt} (${Math.abs(diffDays)} dias atrás)"><i data-lucide="alert-octagon" style="width:12px;height:12px;vertical-align:middle;margin-right:2px;"></i> Vencido (${dataFmt})</span>`
        };
    } else if (diffDays <= 30) {
        return {
            status: 'vencendo',
            diffDays,
            label: diffDays === 0 ? 'Vence hoje!' : `Vence em ${diffDays}d`,
            badgeHtml: `<span class="badge badge-expiring" title="Vence em ${dataFmt} (${diffDays} dias)"><i data-lucide="clock" style="width:12px;height:12px;vertical-align:middle;margin-right:2px;"></i> ${diffDays === 0 ? 'Hoje' : diffDays + ' dias'} (${dataFmt})</span>`
        };
    } else {
        return {
            status: 'ok',
            diffDays,
            label: dataFmt,
            badgeHtml: `<span style="font-size:0.85rem; color:var(--text-secondary);">${dataFmt}</span>`
        };
    }
}

// === Cálculo e Renderização dos Cards de Estatísticas ===
function renderEstoqueStats() {
    const products = DB.get(STORAGE_KEYS.PRODUCTS) || [];

    const totalProdutos = products.length;
    let valorTotalCusto = 0;
    let valorTotalEstoque = 0;
    let totalPecasFisicas = 0;
    let totalBaixo = 0;
    let totalEsgotado = 0;
    let totalVencendoOuVencido = 0;

    products.forEach(p => {
        const estoque = parseFloat(p.estoque) || 0;
        const estoqueMin = parseFloat(p.estoqueMinimo) || 5;
        const precoCusto = parseFloat(p.precoCusto) || 0;
        const precoVenda = parseFloat(p.precoVenda) || 0;

        valorTotalCusto += estoque * precoCusto;
        valorTotalEstoque += estoque * precoVenda;
        totalPecasFisicas += estoque;

        if (estoque <= 0) {
            totalEsgotado++;
        } else if (estoque <= estoqueMin) {
            totalBaixo++;
        }

        if (p.validade) {
            const valInfo = getValidityInfo(p.validade);
            if (valInfo.status === 'vencendo' || valInfo.status === 'vencido') {
                totalVencendoOuVencido++;
            }
        }
    });

    const lucroProjetado = Math.max(0, valorTotalEstoque - valorTotalCusto);
    const margemMedia = valorTotalEstoque > 0 ? ((valorTotalEstoque - valorTotalCusto) / valorTotalEstoque) * 100 : 0;

    // Calcular compras/entradas do mês corrente
    const movements = DB.get(STORAGE_KEYS.STOCK_MOVEMENTS) || [];
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();
    let comprasMes = 0;
    movements.forEach(m => {
        if (m.tipo === 'entrada' && m.data) {
            const d = new Date(m.data);
            if (d.getFullYear() === curYear && d.getMonth() === curMonth) {
                if (typeof m.custoTotal === 'number' && m.custoTotal > 0) {
                    comprasMes += m.custoTotal;
                } else {
                    const prod = products.find(p => p.id === m.produtoId);
                    const cUnit = prod ? (parseFloat(prod.precoCusto) || 0) : 0;
                    comprasMes += (parseFloat(m.quantidade) || 0) * cUnit;
                }
            }
        }
    });

    // Elementos da Visão Financeira
    const elCusto = document.getElementById('stat-custo-estoque');
    const elValor = document.getElementById('stat-valor-estoque');
    const elLucro = document.getElementById('stat-lucro-projetado');
    const elMargem = document.getElementById('stat-margem-media');
    const elCompras = document.getElementById('stat-compras-mes');

    if (elCusto) elCusto.textContent = formatCurrency(valorTotalCusto);
    if (elValor) elValor.textContent = formatCurrency(valorTotalEstoque);
    if (elLucro) elLucro.textContent = formatCurrency(lucroProjetado);
    if (elMargem) elMargem.textContent = `${margemMedia.toFixed(1)}% Margem Média`;
    if (elCompras) elCompras.textContent = formatCurrency(comprasMes);

    // Elementos Operacionais
    const elTotal = document.getElementById('stat-total-produtos');
    const elPecas = document.getElementById('stat-total-pecas');
    const elBaixo = document.getElementById('stat-estoque-baixo');
    const elEsgotado = document.getElementById('stat-esgotados');
    const elVencendo = document.getElementById('stat-vencendo-mes');

    if (elTotal) elTotal.textContent = totalProdutos;
    if (elPecas) elPecas.textContent = `${Math.round(totalPecasFisicas)} un. físicas em saldo`;
    if (elBaixo) elBaixo.textContent = totalBaixo;
    if (elEsgotado) elEsgotado.textContent = totalEsgotado;
    if (elVencendo) elVencendo.textContent = totalVencendoOuVencido;

    // Atualizar badge de pedidos em trânsito no cabeçalho
    const purchaseOrders = DB.get(STORAGE_KEYS.PURCHASE_ORDERS) || [];
    const activeOrders = purchaseOrders.filter(po => po.status === 'em_transito' || po.status === 'atrasado');
    const badgeTransito = document.getElementById('badge-pedidos-transito');
    if (badgeTransito) {
        badgeTransito.textContent = activeOrders.length;
        badgeTransito.style.display = activeOrders.length > 0 ? 'inline-block' : 'none';
    }
}

// === Renderização da Tabela de Produtos ===
function renderProductsTable() {
    const tbody = document.getElementById('estoque-table-body');
    const infoElem = document.getElementById('estoque-table-info');
    if (!tbody) return;

    const products = DB.get(STORAGE_KEYS.PRODUCTS) || [];

    // 1. Filtragem por busca, categoria e status
    const searchTerm = EstoqueState.search.toLowerCase().trim();
    const catFilter = EstoqueState.category;
    const statusFilter = EstoqueState.status;

    // Cache de vendas para filtro de produtos sem giro / capital parado
    let cutoffTime = 0;
    let latestSaleMap = {};
    if (statusFilter === 'sem_giro') {
        const sales = DB.get(STORAGE_KEYS.SALES) || [];
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 30);
        cutoffTime = cutoffDate.getTime();

        sales.forEach(sale => {
            const saleTime = new Date(sale.data).getTime();
            (sale.itens || []).forEach(item => {
                const pId = item.produtoId || item.id;
                if (!latestSaleMap[pId] || saleTime > latestSaleMap[pId]) {
                    latestSaleMap[pId] = saleTime;
                }
            });
        });
    }

    const filtered = products.filter(p => {
        const nameMatch = p.nome && p.nome.toLowerCase().includes(searchTerm);
        const skuMatch = p.sku && p.sku.toLowerCase().includes(searchTerm);
        const fornMatch = p.fornecedor && p.fornecedor.toLowerCase().includes(searchTerm);
        const searchMatches = !searchTerm || nameMatch || skuMatch || fornMatch;

        const catMatches = !catFilter || p.categoria === catFilter;

        let statusMatches = true;
        const estoque = parseFloat(p.estoque) || 0;
        const estoqueMin = parseFloat(p.estoqueMinimo) || 5;
        const valInfo = getValidityInfo(p.validade);

        if (statusFilter === 'esgotado') {
            statusMatches = estoque <= 0;
        } else if (statusFilter === 'baixo') {
            statusMatches = estoque > 0 && estoque <= estoqueMin;
        } else if (statusFilter === 'ok') {
            statusMatches = estoque > estoqueMin;
        } else if (statusFilter === 'sem_giro') {
            const lastSale = latestSaleMap[p.id];
            statusMatches = estoque > 0 && (!lastSale || lastSale < cutoffTime);
        } else if (statusFilter === 'vencendo') {
            statusMatches = valInfo.status === 'vencendo';
        } else if (statusFilter === 'vencido') {
            statusMatches = valInfo.status === 'vencido';
        }

        return searchMatches && catMatches && statusMatches;
    });

    // 2. Ordenação
    filtered.sort((a, b) => {
        let valA = a[EstoqueState.sortColumn];
        let valB = b[EstoqueState.sortColumn];

        if (['precoCusto', 'precoVenda', 'margem', 'estoque', 'estoqueMinimo'].includes(EstoqueState.sortColumn)) {
            valA = parseFloat(valA) || 0;
            valB = parseFloat(valB) || 0;
        } else if (EstoqueState.sortColumn === 'validade') {
            valA = valA ? new Date(valA).getTime() : 9999999999999;
            valB = valB ? new Date(valB).getTime() : 9999999999999;
        } else {
            valA = (valA || '').toString().toLowerCase();
            valB = (valB || '').toString().toLowerCase();
        }

        if (valA < valB) return EstoqueState.sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return EstoqueState.sortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    // 3. Paginação
    const paginated = paginate(filtered, EstoqueState.currentPage, EstoqueState.perPage);

    if (infoElem) {
        infoElem.textContent = `Mostrando ${paginated.data.length} de ${filtered.length} ${filtered.length === 1 ? 'produto' : 'produtos'}`;
    }

    if (paginated.data.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="11">
                    <div class="empty-state" style="padding: 3rem 1rem;">
                        <i data-lucide="package-x"></i>
                        <p>Nenhum produto encontrado</p>
                        <span>Tente alterar os termos de busca ou remover os filtros aplicados</span>
                    </div>
                </td>
            </tr>
        `;
        renderPagination('estoque-pagination', 1, 1, 'changeEstoquePage');
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    // 4. Carregar pedidos em trânsito para alertar na coluna de saldo
    const purchaseOrders = DB.get(STORAGE_KEYS.PURCHASE_ORDERS) || [];
    const pendingOrders = purchaseOrders.filter(po => po.status === 'em_transito' || po.status === 'atrasado');

    // 5. Renderização das linhas
    tbody.innerHTML = paginated.data.map(product => {
        const estoque = parseFloat(product.estoque) || 0;
        const estoqueMin = parseFloat(product.estoqueMinimo) || 5;
        const precoCusto = parseFloat(product.precoCusto) || 0;
        const precoVenda = parseFloat(product.precoVenda) || 0;
        const unidade = product.unidade || 'un';

        // Calcular se há pedidos em trânsito com previsão de chegada para este produto
        let qtdACaminho = 0;
        let dataPrevistaMaisProxima = null;
        pendingOrders.forEach(po => {
            const item = (po.itens || []).find(it => it.produtoId === product.id);
            if (item) {
                qtdACaminho += parseFloat(item.quantidade) || 0;
                if (!dataPrevistaMaisProxima || po.dataPrevista < dataPrevistaMaisProxima) {
                    dataPrevistaMaisProxima = po.dataPrevista;
                }
            }
        });

        let badgeACaminho = '';
        if (qtdACaminho > 0) {
            const now = new Date();
            const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
            const prevMid = dataPrevistaMaisProxima ? new Date(dataPrevistaMaisProxima + (dataPrevistaMaisProxima.includes('T') ? '' : 'T00:00:00')).getTime() : todayMid;
            const diasRestantes = Math.round((prevMid - todayMid) / (1000 * 60 * 60 * 24));
            const atrasado = diasRestantes < 0;
            const prazoFmt = atrasado ? `Atrasado há ${Math.abs(diasRestantes)}d` : (diasRestantes === 0 ? 'Chega hoje!' : `Chega em ${diasRestantes}d`);

            badgeACaminho = `
                <div style="margin-top: 3px;">
                    <span class="badge" style="background:${atrasado ? '#fef2f2' : '#e0f2fe'}; color:${atrasado ? '#b91c1c' : '#0369a1'}; font-size:0.68rem; padding:2px 6px; font-weight:700; cursor:pointer;" onclick="abrirModalPedidosCompra()" title="Pedido a caminho! Previsão de entrega: ${formatDate(dataPrevistaMaisProxima)}">
                        🚚 +${unidade === 'kg' ? qtdACaminho.toFixed(1) : Math.round(qtdACaminho)} ${unidade} (${prazoFmt})
                    </span>
                </div>
            `;
        }

        // Recalcular margem
        const margemCalculada = precoVenda > 0 ? (((precoVenda - precoCusto) / precoVenda) * 100) : 0;

        let marginClass = 'margin-high';
        if (margemCalculada < 20) {
            marginClass = 'margin-low';
        } else if (margemCalculada < 40) {
            marginClass = 'margin-mid';
        }

        // Status Badge
        let statusBadge = '';
        if (estoque <= 0) {
            statusBadge = `<span class="badge badge-danger"><span class="status-dot cancelado"></span>Esgotado</span>`;
        } else if (estoque <= estoqueMin) {
            statusBadge = `<span class="badge badge-warning"><span class="status-dot agendado"></span>Baixo</span>`;
        } else {
            statusBadge = `<span class="badge badge-success"><span class="status-dot concluido"></span>OK</span>`;
        }

        const categoryIcon = getEstoqueCategoryIcon(product.categoria);
        const valInfo = getValidityInfo(product.validade);
        const saldoFormatado = unidade === 'kg' ? estoque.toFixed(1) : Math.round(estoque);

        return `
            <tr>
                <td>
                    <div class="product-thumb">
                        <i data-lucide="${categoryIcon}" style="width: 20px; height: 20px;"></i>
                    </div>
                </td>
                <td>
                    <div style="font-weight: 600; color: var(--text-primary);">${escapeHtml(product.nome)}</div>
                    ${product.fornecedor ? `<small class="text-muted">Fornec: ${escapeHtml(product.fornecedor)}</small>` : ''}
                </td>
                <td>
                    <span class="badge badge-neutral">${escapeHtml(product.categoria || 'Geral')}</span>
                </td>
                <td>
                    <span style="font-family: monospace; font-size: 0.85rem; background: var(--bg); padding: 2px 6px; border-radius: 4px;">
                        ${escapeHtml(product.sku || '-')}
                    </span>
                </td>
                <td>
                    <span>${formatCurrency(precoCusto)}</span>
                </td>
                <td>
                    <strong style="color: var(--primary);">${formatCurrency(precoVenda)}</strong>
                    <div style="font-size:0.7rem; color:var(--text-secondary);">${unidade === 'kg' ? '/ kg' : '/ un.'}</div>
                </td>
                <td>
                    <span class="margin-indicator ${marginClass}">
                        ${margemCalculada.toFixed(1)}%
                    </span>
                </td>
                <td>
                    <div style="font-weight: 600; ${estoque <= estoqueMin ? 'color: var(--danger);' : ''}">
                        ${saldoFormatado} ${unidade}
                    </div>
                    <small class="text-muted" style="font-size: 0.72rem;">Mín: ${estoqueMin} ${unidade}</small>
                    ${badgeACaminho}
                </td>
                <td>
                    ${valInfo.badgeHtml}
                </td>
                <td>
                    ${statusBadge}
                </td>
                <td style="text-align: right;">
                    <div class="table-actions" style="justify-content: flex-end;">
                        <button class="btn-icon" onclick="openStockMovementModal('${product.id}')" title="Movimentar estoque rápido" style="color: var(--primary);">
                            <i data-lucide="arrow-left-right"></i>
                        </button>
                        <button class="btn-icon" onclick="editProduct('${product.id}')" title="Editar produto">
                            <i data-lucide="edit-3"></i>
                        </button>
                        <button class="btn-icon" onclick="deleteProduct('${product.id}')" title="Excluir produto" style="color: var(--danger);">
                            <i data-lucide="trash-2"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    renderPagination('estoque-pagination', paginated.currentPage, paginated.totalPages, 'changeEstoquePage');
    updateSortIcons();

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// Atualizar ícones das colunas ordenáveis
function updateSortIcons() {
    ['nome', 'categoria', 'sku', 'precoCusto', 'precoVenda', 'margem', 'estoque', 'validade'].forEach(col => {
        const icon = document.getElementById(`sort-icon-${col}`);
        if (!icon) return;
        if (EstoqueState.sortColumn === col) {
            icon.setAttribute('data-lucide', EstoqueState.sortDirection === 'asc' ? 'arrow-up' : 'arrow-down');
        } else {
            icon.setAttribute('data-lucide', 'chevrons-up-down');
        }
    });
}

function getEstoqueCategoryIcon(categoria) {
    if (!categoria) return 'package';
    const cat = categoria.toLowerCase();
    if (cat.includes('ração') || cat.includes('racao')) return 'bone';
    if (cat.includes('petisco')) return 'cookie';
    if (cat.includes('brinquedo')) return 'smile';
    if (cat.includes('higiene') || cat.includes('limpeza')) return 'sparkles';
    if (cat.includes('acessório') || cat.includes('acessorio') || cat.includes('coleira')) return 'tag';
    if (cat.includes('medicamento') || cat.includes('farmácia')) return 'activity';
    return 'package';
}

// === Ordenação de Colunas ===
function handleSort(column) {
    if (EstoqueState.sortColumn === column) {
        EstoqueState.sortDirection = EstoqueState.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        EstoqueState.sortColumn = column;
        EstoqueState.sortDirection = 'asc';
    }
    renderProductsTable();
}

// === Filtros de Busca e Status ===
function handleEstoqueSearch() {
    const input = document.getElementById('estoque-search-input');
    EstoqueState.search = input ? input.value : '';
    EstoqueState.currentPage = 1;
    renderProductsTable();
}

function handleEstoqueCategoryFilter() {
    const select = document.getElementById('estoque-category-filter');
    EstoqueState.category = select ? select.value : '';
    EstoqueState.currentPage = 1;
    renderProductsTable();
}

function handleEstoqueStatusFilter() {
    const select = document.getElementById('estoque-status-filter');
    EstoqueState.status = select ? select.value : '';
    EstoqueState.currentPage = 1;
    renderProductsTable();
}

function clearEstoqueFilters() {
    EstoqueState.search = '';
    EstoqueState.category = '';
    EstoqueState.status = '';
    EstoqueState.currentPage = 1;

    const sInput = document.getElementById('estoque-search-input');
    const cSelect = document.getElementById('estoque-category-filter');
    const stSelect = document.getElementById('estoque-status-filter');

    if (sInput) sInput.value = '';
    if (cSelect) cSelect.value = '';
    if (stSelect) stSelect.value = '';

    renderProductsTable();
}

// Troca de página
window.changeEstoquePage = function(page) {
    EstoqueState.currentPage = page;
    renderProductsTable();
};

// === Cálculo Automático de Margem de Lucro no Modal ===
function calculateModalMargin() {
    const custoInput = document.getElementById('product-preco-custo');
    const vendaInput = document.getElementById('product-preco-venda');
    const margemInput = document.getElementById('product-margem');

    const precoCusto = parseFloat(custoInput ? custoInput.value : 0) || 0;
    const precoVenda = parseFloat(vendaInput ? vendaInput.value : 0) || 0;

    let margin = 0;
    if (precoVenda > 0) {
        margin = ((precoVenda - precoCusto) / precoVenda) * 100;
    }

    if (margemInput) {
        margemInput.value = margin.toFixed(2) + ' %';
        if (margin >= 40) {
            margemInput.style.color = 'var(--success)';
        } else if (margin >= 20) {
            margemInput.style.color = 'var(--warning)';
        } else {
            margemInput.style.color = 'var(--danger)';
        }
    }

    return margin;
}

// === CRUD DE PRODUTOS ===

// Abrir modal para novo produto
function openNewProductModal() {
    EstoqueState.editingProductId = null;

    const modalTitle = document.getElementById('modal-product-title');
    if (modalTitle) modalTitle.textContent = 'Novo Produto';

    document.getElementById('product-id').value = '';
    document.getElementById('product-nome').value = '';
    document.getElementById('product-sku').value = '';
    document.getElementById('product-fornecedor').value = '';
    document.getElementById('product-estoque-minimo').value = 5;
    document.getElementById('product-preco-custo').value = '';
    document.getElementById('product-preco-venda').value = '';
    document.getElementById('product-estoque').value = 0;
    document.getElementById('product-unidade').value = 'un';
    document.getElementById('product-validade').value = '';
    document.getElementById('product-descricao').value = '';

    populateEstoqueCategories();
    calculateModalMargin();

    openModal('modal-produto');
}

// Abrir modal para editar produto existente
function editProduct(productId) {
    const products = DB.get(STORAGE_KEYS.PRODUCTS) || [];
    const product = products.find(p => p.id === productId);

    if (!product) {
        showToast('Produto não encontrado!', 'error');
        return;
    }

    EstoqueState.editingProductId = productId;

    const modalTitle = document.getElementById('modal-product-title');
    if (modalTitle) modalTitle.textContent = 'Editar Produto';

    populateEstoqueCategories();

    document.getElementById('product-id').value = product.id;
    document.getElementById('product-nome').value = product.nome || '';
    document.getElementById('product-categoria').value = product.categoria || '';
    document.getElementById('product-sku').value = product.sku || '';
    document.getElementById('product-fornecedor').value = product.fornecedor || '';
    document.getElementById('product-estoque-minimo').value = product.estoqueMinimo != null ? product.estoqueMinimo : 5;
    document.getElementById('product-preco-custo').value = product.precoCusto != null ? product.precoCusto : '';
    document.getElementById('product-preco-venda').value = product.precoVenda != null ? product.precoVenda : '';
    document.getElementById('product-estoque').value = product.estoque != null ? product.estoque : 0;
    document.getElementById('product-unidade').value = product.unidade || 'un';
    document.getElementById('product-validade').value = product.validade || '';
    document.getElementById('product-descricao').value = product.descricao || '';

    calculateModalMargin();

    openModal('modal-produto');
}

// Salvar produto (criação ou edição)
function saveProduct() {
    const nomeInput = document.getElementById('product-nome');
    const catInput = document.getElementById('product-categoria');
    const precoCustoInput = document.getElementById('product-preco-custo');
    const precoVendaInput = document.getElementById('product-preco-venda');

    const nome = (nomeInput ? nomeInput.value : '').trim();
    const categoria = catInput ? catInput.value : '';
    const precoCusto = parseFloat(precoCustoInput ? precoCustoInput.value : 0) || 0;
    const precoVenda = parseFloat(precoVendaInput ? precoVendaInput.value : 0) || 0;

    if (!nome) {
        showToast('Por favor, informe o nome do produto.', 'warning');
        if (nomeInput) nomeInput.focus();
        return;
    }

    if (!categoria) {
        showToast('Por favor, selecione uma categoria para o produto.', 'warning');
        if (catInput) catInput.focus();
        return;
    }

    if (precoVenda <= 0) {
        showToast('O preço de venda deve ser maior que R$ 0,00.', 'warning');
        if (precoVendaInput) precoVendaInput.focus();
        return;
    }

    const sku = (document.getElementById('product-sku').value || '').trim();
    const fornecedor = (document.getElementById('product-fornecedor').value || '').trim();
    const estoqueMinimo = parseFloat(document.getElementById('product-estoque-minimo').value) || 5;
    const estoque = parseFloat(document.getElementById('product-estoque').value) || 0;
    const unidade = document.getElementById('product-unidade').value || 'un';
    const validade = document.getElementById('product-validade').value || '';
    const descricao = (document.getElementById('product-descricao').value || '').trim();

    const margem = precoVenda > 0 ? (((precoVenda - precoCusto) / precoVenda) * 100) : 0;
    const products = DB.get(STORAGE_KEYS.PRODUCTS) || [];

    if (EstoqueState.editingProductId) {
        const index = products.findIndex(p => p.id === EstoqueState.editingProductId);
        if (index === -1) {
            showToast('Erro ao atualizar: produto não encontrado.', 'error');
            return;
        }

        const existing = products[index];
        const oldEstoque = parseFloat(existing.estoque) || 0;

        products[index] = {
            ...existing,
            nome,
            categoria,
            sku: sku || existing.sku,
            fornecedor,
            estoqueMinimo,
            precoCusto,
            precoVenda,
            margem: parseFloat(margem.toFixed(2)),
            estoque,
            unidade,
            validade,
            descricao
        };

        if (oldEstoque !== estoque) {
            const diff = estoque - oldEstoque;
            const stockMovements = DB.get(STORAGE_KEYS.STOCK_MOVEMENTS) || [];
            stockMovements.unshift({
                id: 'mov_' + DB.generateId(),
                produtoId: existing.id,
                tipo: diff > 0 ? 'entrada' : 'saida',
                quantidade: Math.abs(diff),
                motivo: 'Ajuste manual de cadastro',
                data: new Date().toISOString()
            });
            DB.save(STORAGE_KEYS.STOCK_MOVEMENTS, stockMovements);
        }

        DB.save(STORAGE_KEYS.PRODUCTS, products);
        showToast('Produto atualizado com sucesso!', 'success');
    } else {
        const newId = 'prod_' + DB.generateId();
        const autoSku = sku || ('SKU' + Math.floor(1000 + Math.random() * 9000));

        const newProduct = {
            id: newId,
            nome,
            categoria,
            sku: autoSku,
            fornecedor,
            estoqueMinimo,
            precoCusto,
            precoVenda,
            margem: parseFloat(margem.toFixed(2)),
            estoque,
            unidade,
            validade,
            descricao,
            foto: ''
        };

        products.unshift(newProduct);
        DB.save(STORAGE_KEYS.PRODUCTS, products);

        if (estoque > 0) {
            const stockMovements = DB.get(STORAGE_KEYS.STOCK_MOVEMENTS) || [];
            stockMovements.unshift({
                id: 'mov_' + DB.generateId(),
                produtoId: newId,
                tipo: 'entrada',
                quantidade: estoque,
                motivo: 'Estoque inicial do cadastro',
                data: new Date().toISOString()
            });
            DB.save(STORAGE_KEYS.STOCK_MOVEMENTS, stockMovements);
        }

        showToast('Produto cadastrado com sucesso!', 'success');
    }

    closeModal('modal-produto');
    renderEstoqueStats();
    renderProductsTable();

    if (typeof checkStockAlerts === 'function') {
        checkStockAlerts();
    }
}

// Excluir produto
async function deleteProduct(productId) {
    const products = DB.get(STORAGE_KEYS.PRODUCTS) || [];
    const product = products.find(p => p.id === productId);

    if (!product) return;

    const confirmed = await confirmDialog(`Tem certeza de que deseja excluir o produto "${product.nome}"? Esta ação não pode ser desfeita.`);
    if (!confirmed) return;

    const updated = products.filter(p => p.id !== productId);
    DB.save(STORAGE_KEYS.PRODUCTS, updated);

    showToast(`Produto "${product.nome}" excluído com sucesso.`, 'success');
    renderEstoqueStats();
    renderProductsTable();

    if (typeof checkStockAlerts === 'function') {
        checkStockAlerts();
    }
}

// === MOVIMENTAÇÃO DE ESTOQUE ===

function openStockMovementModal(preselectedProductId = null) {
    const select = document.getElementById('mov-product-select');
    if (!select) return;

    const products = DB.get(STORAGE_KEYS.PRODUCTS) || [];
    products.sort((a, b) => a.nome.localeCompare(b.nome));

    select.innerHTML = '<option value="">Selecione um produto...</option>' +
        products.map(p => {
            const un = p.unidade || 'un';
            const est = un === 'kg' ? (parseFloat(p.estoque) || 0).toFixed(1) : Math.round(parseFloat(p.estoque) || 0);
            return `
                <option value="${p.id}" ${p.id === preselectedProductId ? 'selected' : ''}>
                    ${escapeHtml(p.nome)} (Saldo: ${est} ${un})
                </option>
            `;
        }).join('');

    document.getElementById('mov-tipo').value = 'entrada';
    document.getElementById('mov-quantidade').value = 1;
    document.getElementById('mov-motivo').value = '';

    // Configurar campos financeiros de compra
    const chkDespesa = document.getElementById('mov-gerar-despesa');
    if (chkDespesa) chkDespesa.checked = false;
    const boxDespesa = document.getElementById('mov-despesa-fields');
    if (boxDespesa) boxDespesa.style.display = 'none';

    // Data de vencimento padrão: 30 dias à frente
    const inputVenc = document.getElementById('mov-despesa-vencimento');
    if (inputVenc) {
        const d = new Date();
        d.setDate(d.getDate() + 30);
        inputVenc.value = d.toISOString().split('T')[0];
    }

    handleMovementProductChange();
    updateMovementPreview();
    openModal('modal-movimentacao');
}

function handleMovementProductChange() {
    const select = document.getElementById('mov-product-select');
    const inputCusto = document.getElementById('mov-custo-unitario');
    if (select && inputCusto) {
        const productId = select.value;
        const products = DB.get(STORAGE_KEYS.PRODUCTS) || [];
        const product = products.find(p => p.id === productId);
        if (product) {
            inputCusto.value = (parseFloat(product.precoCusto) || 0).toFixed(2);
        }
    }
    updateMovementFinancials();
    updateMovementPreview();
}

function updateMovementFinancials() {
    const inputQtd = document.getElementById('mov-quantidade');
    const inputCusto = document.getElementById('mov-custo-unitario');
    const displayTotal = document.getElementById('mov-custo-total');
    if (!inputQtd || !inputCusto || !displayTotal) return;

    const qtd = parseFloat(inputQtd.value) || 0;
    const custo = parseFloat(inputCusto.value) || 0;
    const total = qtd * custo;
    displayTotal.value = formatCurrency(total);
}

function toggleMovGerarDespesa() {
    const chk = document.getElementById('mov-gerar-despesa');
    const box = document.getElementById('mov-despesa-fields');
    if (chk && box) {
        box.style.display = chk.checked ? 'block' : 'none';
    }
}

function updateMovementPreview() {
    const select = document.getElementById('mov-product-select');
    const tipoSelect = document.getElementById('mov-tipo');
    const qtdInput = document.getElementById('mov-quantidade');
    const finBox = document.getElementById('mov-financeiro-box');

    const prevAtual = document.getElementById('prev-estoque-atual');
    const prevOp = document.getElementById('prev-operacao');
    const prevNovo = document.getElementById('prev-novo-estoque');

    if (!select || !tipoSelect || !qtdInput) return;

    const productId = select.value;
    const tipo = tipoSelect.value;
    const qtd = parseFloat(qtdInput.value) || 0;

    // Exibir bloco financeiro somente quando tipo for 'entrada'
    if (finBox) {
        finBox.style.display = tipo === 'entrada' ? 'block' : 'none';
    }
    updateMovementFinancials();

    const products = DB.get(STORAGE_KEYS.PRODUCTS) || [];
    const product = products.find(p => p.id === productId);

    const estoqueAtual = product ? (parseFloat(product.estoque) || 0) : 0;
    const unidade = product ? (product.unidade || 'un') : 'un';
    let novoEstoque = estoqueAtual;

    if (tipo === 'entrada') {
        novoEstoque = estoqueAtual + qtd;
        if (prevOp) prevOp.innerHTML = `<span class="text-success">+ ${qtd} ${unidade}</span>`;
    } else {
        novoEstoque = estoqueAtual - qtd;
        if (prevOp) prevOp.innerHTML = `<span class="text-danger">- ${qtd} ${unidade}</span>`;
    }

    const fmtAtual = unidade === 'kg' ? estoqueAtual.toFixed(1) : Math.round(estoqueAtual);
    const fmtNovo = unidade === 'kg' ? novoEstoque.toFixed(1) : Math.round(novoEstoque);

    if (prevAtual) prevAtual.textContent = `${fmtAtual} ${unidade}`;
    if (prevNovo) {
        prevNovo.textContent = `${fmtNovo} ${unidade}`;
        if (novoEstoque < 0) {
            prevNovo.className = 'val text-danger';
        } else if (product && novoEstoque <= product.estoqueMinimo) {
            prevNovo.className = 'val text-warning';
        } else {
            prevNovo.className = 'val text-success';
        }
    }
}

async function saveStockMovement() {
    const select = document.getElementById('mov-product-select');
    const tipoSelect = document.getElementById('mov-tipo');
    const qtdInput = document.getElementById('mov-quantidade');
    const motivoInput = document.getElementById('mov-motivo');

    const productId = select ? select.value : '';
    const tipo = tipoSelect ? tipoSelect.value : 'entrada';
    const quantidade = parseFloat(qtdInput ? qtdInput.value : 0) || 0;
    const motivo = (motivoInput ? motivoInput.value : '').trim();

    if (!productId) {
        showToast('Selecione um produto para movimentar.', 'warning');
        return;
    }

    if (quantidade <= 0) {
        showToast('A quantidade a movimentar deve ser maior que 0.', 'warning');
        return;
    }

    if (!motivo) {
        showToast('Informe o motivo ou justificativa da movimentação.', 'warning');
        return;
    }

    const products = DB.get(STORAGE_KEYS.PRODUCTS) || [];
    const productIndex = products.findIndex(p => p.id === productId);

    if (productIndex === -1) {
        showToast('Produto não encontrado.', 'error');
        return;
    }

    const product = products[productIndex];
    const estoqueAtual = parseFloat(product.estoque) || 0;
    const unidade = product.unidade || 'un';

    if (tipo === 'saida' && quantidade > estoqueAtual) {
        const proceed = await confirmDialog(`Atenção: A saída (${quantidade} ${unidade}) é maior que o saldo atual (${estoqueAtual} ${unidade}). O estoque ficará zerado ou negativo. Deseja prosseguir?`);
        if (!proceed) return;
    }

    // Informações financeiras da entrada
    let custoUnit = parseFloat(product.precoCusto) || 0;
    let custoTotal = 0;
    if (tipo === 'entrada') {
        const inputCusto = document.getElementById('mov-custo-unitario');
        if (inputCusto && !isNaN(parseFloat(inputCusto.value))) {
            custoUnit = parseFloat(inputCusto.value);
            // Atualizar também o preço de custo do produto no cadastro se foi modificado
            if (custoUnit > 0) {
                product.precoCusto = custoUnit;
                const pVenda = parseFloat(product.precoVenda) || 0;
                if (pVenda > 0) {
                    product.margem = parseFloat((((pVenda - custoUnit) / pVenda) * 100).toFixed(2));
                }
            }
        }
        custoTotal = quantidade * custoUnit;
    }

    if (tipo === 'entrada') {
        product.estoque = estoqueAtual + quantidade;
    } else {
        product.estoque = Math.max(0, estoqueAtual - quantidade);
    }
    products[productIndex] = product;
    DB.save(STORAGE_KEYS.PRODUCTS, products);

    // Gravar no histórico de movimentações
    const stockMovements = DB.get(STORAGE_KEYS.STOCK_MOVEMENTS) || [];
    stockMovements.unshift({
        id: 'mov_' + DB.generateId(),
        produtoId: product.id,
        tipo: tipo,
        quantidade: quantidade,
        motivo: motivo,
        custoUnitario: custoUnit,
        custoTotal: custoTotal,
        data: new Date().toISOString()
    });
    DB.save(STORAGE_KEYS.STOCK_MOVEMENTS, stockMovements);

    // Integração com o Financeiro (Contas a Pagar)
    const chkDespesa = document.getElementById('mov-gerar-despesa');
    let despesaLancada = false;
    if (tipo === 'entrada' && chkDespesa && chkDespesa.checked && custoTotal > 0) {
        const vencimentoInput = document.getElementById('mov-despesa-vencimento');
        const formaInput = document.getElementById('mov-despesa-forma');
        const vencimento = vencimentoInput && vencimentoInput.value ? vencimentoInput.value : new Date().toISOString().split('T')[0];
        const forma = formaInput ? formaInput.value : 'Boleto';

        const expenses = DB.get(STORAGE_KEYS.EXPENSES) || [];
        expenses.unshift({
            id: DB.generateId(),
            descricao: `Compra Estoque: ${product.nome} (${quantidade} ${unidade})`,
            categoria: 'Estoque / Mercadorias',
            valor: custoTotal,
            data: vencimento,
            recorrente: false,
            status: 'pendente',
            formaPagamento: forma
        });
        DB.save(STORAGE_KEYS.EXPENSES, expenses);
        despesaLancada = true;
    }

    closeModal('modal-movimentacao');

    if (despesaLancada) {
        showToast(`Entrada registrada e conta a pagar de ${formatCurrency(custoTotal)} lançada no Financeiro!`, 'success');
    } else {
        showToast(`Movimentação de ${tipo === 'entrada' ? 'entrada' : 'saída'} registrada com sucesso!`, 'success');
    }

    renderEstoqueStats();
    renderProductsTable();

    if (typeof checkStockAlerts === 'function') {
        checkStockAlerts();
    }
}

// === LISTA DE COMPRAS AUTOMÁTICA (FORNECEDOR) ===

function abrirModalListaCompras() {
    const tbody = document.getElementById('lista-compras-tbody');
    const resumoItens = document.getElementById('compras-resumo-itens');
    const totalEstimadoEl = document.getElementById('compras-total-estimado');
    if (!tbody) return;

    const products = DB.get(STORAGE_KEYS.PRODUCTS) || [];
    // Filtra produtos com estoque menor ou igual ao mínimo
    const produtosRepor = products.filter(p => {
        const est = parseFloat(p.estoque) || 0;
        const min = parseFloat(p.estoqueMinimo) || 5;
        return est <= min;
    });

    if (produtosRepor.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align:center; padding:2rem; color:var(--text-secondary);">
                    🎉 <strong>Tudo em ordem!</strong> Nenhum produto precisa de reposição no momento.
                </td>
            </tr>
        `;
        if (resumoItens) resumoItens.textContent = '0 produtos para reposição';
        if (totalEstimadoEl) totalEstimadoEl.textContent = 'R$ 0,00';
        openModal('modal-lista-compras');
        return;
    }

    let totalGeral = 0;
    let html = '';

    const purchaseOrders = DB.get(STORAGE_KEYS.PURCHASE_ORDERS) || [];
    const pendingOrders = purchaseOrders.filter(po => po.status === 'em_transito' || po.status === 'atrasado');

    produtosRepor.forEach(p => {
        const est = parseFloat(p.estoque) || 0;
        const min = parseFloat(p.estoqueMinimo) || 5;
        const custo = parseFloat(p.precoCusto) || 0;
        const unidade = p.unidade || 'un';

        // Verificar se já tem pedido a caminho
        let qtdACaminho = 0;
        let dataPrevista = null;
        pendingOrders.forEach(po => {
            const it = (po.itens || []).find(item => item.produtoId === p.id);
            if (it) {
                qtdACaminho += parseFloat(it.quantidade) || 0;
                if (!dataPrevista || po.dataPrevista < dataPrevista) dataPrevista = po.dataPrevista;
            }
        });

        // Sugestão: repor o dobro do mínimo subtraído do que já tem
        const qtdSugerida = Math.max(Math.ceil((min * 2) - est), min);
        const subtotal = qtdSugerida * custo;
        totalGeral += subtotal;

        let aCaminhoTag = '';
        if (qtdACaminho > 0) {
            aCaminhoTag = `<div style="font-size:0.72rem; color:#0284c7; font-weight:700; margin-top:3px;">🚚 Já encomendado: +${qtdACaminho} ${unidade} (chega ${formatDate(dataPrevista)})</div>`;
        }

        html += `
            <tr>
                <td>
                    <strong>${escapeHtml(p.nome)}</strong>
                    <div style="font-size:0.75rem; color:var(--text-secondary);">${escapeHtml(p.categoria || '')} ${p.sku ? '• SKU: ' + p.sku : ''}</div>
                    ${aCaminhoTag}
                </td>
                <td>${escapeHtml(p.fornecedor || 'Diversos')}</td>
                <td style="color:${est <= 0 ? 'var(--danger)' : 'var(--warning)'}; font-weight:600;">
                    ${unidade === 'kg' ? est.toFixed(1) : Math.round(est)} ${unidade}
                </td>
                <td>${min} ${unidade}</td>
                <td>
                    <span style="font-weight:700; color:var(--primary); background:#e3f2fd; padding:3px 8px; border-radius:4px;">
                        ${qtdSugerida} ${unidade}
                    </span>
                </td>
                <td>${formatCurrency(custo)}</td>
                <td style="font-weight:600;">${formatCurrency(subtotal)}</td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
    if (resumoItens) resumoItens.textContent = `${produtosRepor.length} produtos necessitando reposição`;
    if (totalEstimadoEl) totalEstimadoEl.textContent = formatCurrency(totalGeral);

    openModal('modal-lista-compras');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function converterListaComprasEmPedido() {
    const products = DB.get(STORAGE_KEYS.PRODUCTS) || [];
    const produtosRepor = products.filter(p => {
        const est = parseFloat(p.estoque) || 0;
        const min = parseFloat(p.estoqueMinimo) || 5;
        return est <= min;
    });

    if (produtosRepor.length === 0) {
        showToast('Nenhum item na lista de compras para gerar pedido.', 'info');
        return;
    }

    const items = produtosRepor.map(p => {
        const est = parseFloat(p.estoque) || 0;
        const min = parseFloat(p.estoqueMinimo) || 5;
        const custo = parseFloat(p.precoCusto) || 0;
        const qtdSugerida = Math.max(Math.ceil((min * 2) - est), min);
        return {
            produtoId: p.id,
            produtoNome: p.nome,
            unidade: p.unidade || 'un',
            quantidade: qtdSugerida,
            custoUnitario: custo,
            subtotal: qtdSugerida * custo
        };
    });

    closeModal('modal-lista-compras');
    abrirModalNovoPedido(items);
    showToast(`${items.length} itens da lista de compras carregados no novo pedido!`, 'info');
}

function gerarTextoPedidoFornecedor() {
    const products = DB.get(STORAGE_KEYS.PRODUCTS) || [];
    const settings = DB.get(STORAGE_KEYS.SETTINGS) || {};
    const nomePetshop = settings.nomeFantasia || 'PetShop Manager';

    const produtosRepor = products.filter(p => {
        const est = parseFloat(p.estoque) || 0;
        const min = parseFloat(p.estoqueMinimo) || 5;
        return est <= min;
    });

    if (produtosRepor.length === 0) return '';

    const dataHoje = new Date().toLocaleDateString('pt-BR');
    let texto = `🛒 *PEDIDO DE REPOSIÇÃO DE ESTOQUE*\n`;
    texto += `🏬 *${nomePetshop}*\n`;
    texto += `📅 *Data:* ${dataHoje}\n\n`;
    texto += `Olá! Gostaria de fazer a cotação/pedido dos seguintes itens em falta:\n\n`;

    let totalEstimado = 0;
    produtosRepor.forEach((p, idx) => {
        const est = parseFloat(p.estoque) || 0;
        const min = parseFloat(p.estoqueMinimo) || 5;
        const custo = parseFloat(p.precoCusto) || 0;
        const unidade = p.unidade || 'un';
        const qtdSugerida = Math.max(Math.ceil((min * 2) - est), min);
        const subtotal = qtdSugerida * custo;
        totalEstimado += subtotal;

        texto += `${idx + 1}. *${p.nome}*\n`;
        texto += `   • *Qtd Solicitada:* ${qtdSugerida} ${unidade}\n`;
        texto += `   • *Estoque Atual:* ${unidade === 'kg' ? est.toFixed(1) : Math.round(est)} ${unidade} (Mín: ${min})\n`;
        if (p.fornecedor) texto += `   • *Fornecedor Ref:* ${p.fornecedor}\n`;
        texto += `\n`;
    });

    texto += `💰 *Valor Estimado de Custo:* ${formatCurrency(totalEstimado)}\n\n`;
    texto += `Por favor, nos confirme a disponibilidade de entrega e valores atualizados. Obrigado! 🐾`;

    return texto;
}

function enviarPedidoFornecedorWhatsApp() {
    const texto = gerarTextoPedidoFornecedor();
    if (!texto) {
        showToast('Não há itens na lista de reposição.', 'warning');
        return;
    }
    const encoded = encodeURIComponent(texto);
    const url = `https://api.whatsapp.com/send?text=${encoded}`;
    window.open(url, '_blank');
}

function copiarListaComprasTexto() {
    const texto = gerarTextoPedidoFornecedor();
    if (!texto) {
        showToast('Não há itens na lista de reposição.', 'warning');
        return;
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(texto).then(() => {
            showToast('Texto do pedido copiado com sucesso!', 'success');
        }).catch(() => {
            fallbackCopy(texto);
        });
    } else {
        fallbackCopy(texto);
    }
}

function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('Texto do pedido copiado com sucesso!', 'success');
}

// === GERADOR DE ETIQUETAS DE PREÇO / GÔNDOLA ===

function abrirModalEtiquetas() {
    const catSelect = document.getElementById('etiquetas-categoria-select');
    const settings = DB.get(STORAGE_KEYS.SETTINGS) || {};
    const defaultCategories = ['Rações', 'Petiscos', 'Brinquedos', 'Higiene', 'Acessórios', 'Medicamentos'];
    const categories = settings.categoriasProdutos && settings.categoriasProdutos.length > 0 
        ? [...settings.categoriasProdutos] 
        : defaultCategories;

    const products = DB.get(STORAGE_KEYS.PRODUCTS) || [];
    products.forEach(p => {
        if (p.categoria && !categories.includes(p.categoria)) {
            categories.push(p.categoria);
        }
    });

    if (catSelect) {
        catSelect.innerHTML = '<option value="">Todas as Categorias</option>' +
            categories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
    }

    renderEtiquetasPreview();
    openModal('modal-etiquetas');
}

function renderEtiquetasPreview() {
    const container = document.getElementById('etiquetas-grid-container');
    const catSelect = document.getElementById('etiquetas-categoria-select');
    if (!container) return;

    const categoriaEscolhida = catSelect ? catSelect.value : '';
    const products = DB.get(STORAGE_KEYS.PRODUCTS) || [];
    const settings = DB.get(STORAGE_KEYS.SETTINGS) || {};
    const nomePetshop = settings.nomeFantasia || 'PetShop Manager';

    const filtrados = categoriaEscolhida 
        ? products.filter(p => p.categoria === categoriaEscolhida)
        : products;

    if (filtrados.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1 / -1; text-align:center; padding: 2rem; color:var(--text-secondary);">
                Nenhum produto cadastrado para imprimir etiquetas nesta categoria.
            </div>
        `;
        return;
    }

    container.innerHTML = filtrados.map(p => {
        const unidade = p.unidade || 'un';
        const precoFmt = formatCurrency(p.precoVenda);
        const skuFmt = p.sku || 'N/A';

        return `
            <div class="product-label-tag">
                <div class="label-shop-name">🐾 ${escapeHtml(nomePetshop)}</div>
                <div class="label-product-name">${escapeHtml(p.nome)}</div>
                <div style="font-size:0.75rem; color:#555;">Preço por ${unidade === 'kg' ? 'quilo (kg)' : 'unidade'}:</div>
                <div class="label-product-price">${precoFmt}</div>
                <div class="label-product-barcode">
                    <span>SKU: ${escapeHtml(skuFmt)}</span>
                    <span style="letter-spacing: 2px; font-weight:bold;">||||| | ||||| ||</span>
                </div>
            </div>
        `;
    }).join('');
}

// === FRACIONAMENTO DE RAÇÃO (SACO FECHADO -> GRANEL KG) ===

function abrirModalFracionamento() {
    const sacoSelect = document.getElementById('frac-saco-select');
    const destinoSelect = document.getElementById('frac-destino-select');
    if (!sacoSelect || !destinoSelect) return;

    const products = DB.get(STORAGE_KEYS.PRODUCTS) || [];

    // Produtos em sacos ou fechados (categoria Rações ou unidade != kg)
    const produtosSacos = products.filter(p => {
        const cat = (p.categoria || '').toLowerCase();
        return (cat.includes('ração') || cat.includes('racao')) && p.unidade !== 'kg';
    });

    sacoSelect.innerHTML = '<option value="">Selecione a ração em saco fechado...</option>' +
        produtosSacos.map(p => {
            const est = Math.round(parseFloat(p.estoque) || 0);
            return `<option value="${p.id}" data-nome="${escapeHtml(p.nome)}">${escapeHtml(p.nome)} (Saldo: ${est} un.)</option>`;
        }).join('');

    // Produtos a granel disponíveis
    const produtosGranel = products.filter(p => p.unidade === 'kg' || (p.nome && p.nome.toLowerCase().includes('granel')));

    let destinoHtml = '<option value="">Selecione o produto de destino a granel...</option>';
    destinoHtml += '<option value="__novo__">➕ Criar novo item a granel automaticamente</option>';
    produtosGranel.forEach(p => {
        const est = (parseFloat(p.estoque) || 0).toFixed(1);
        destinoHtml += `<option value="${p.id}">${escapeHtml(p.nome)} (Saldo atual: ${est} kg)</option>`;
    });
    destinoSelect.innerHTML = destinoHtml;

    document.getElementById('frac-qtd-sacos').value = 1;
    document.getElementById('frac-peso-saco').value = 15;

    calcularFracionamentoPreview();
    openModal('modal-fracionamento');
}

function handleFracSacoChange() {
    const sacoSelect = document.getElementById('frac-saco-select');
    const pesoInput = document.getElementById('frac-peso-saco');
    const destinoSelect = document.getElementById('frac-destino-select');
    if (!sacoSelect) return;

    const selectedOption = sacoSelect.options[sacoSelect.selectedIndex];
    if (!selectedOption || !selectedOption.value) return;

    const nome = selectedOption.getAttribute('data-nome') || '';

    // Tentar detectar peso do saco no nome (ex: 15kg, 20kg, 3kg, 10.1kg)
    const match = nome.match(/(\d+([\.,]\d+)?)\s*kg/i);
    if (match && pesoInput) {
        pesoInput.value = match[1].replace(',', '.');
    }

    // Tentar auto-selecionar produto a granel correspondente
    if (destinoSelect) {
        const products = DB.get(STORAGE_KEYS.PRODUCTS) || [];
        const baseName = nome.replace(/\d+\s*kg/i, '').replace(/ração/i, '').trim().toLowerCase();
        const found = products.find(p => p.unidade === 'kg' && p.nome.toLowerCase().includes(baseName));
        if (found) {
            destinoSelect.value = found.id;
        } else {
            destinoSelect.value = '__novo__';
        }
    }

    calcularFracionamentoPreview();
}

function calcularFracionamentoPreview() {
    const qtdSacos = parseInt(document.getElementById('frac-qtd-sacos').value) || 1;
    const pesoSaco = parseFloat(document.getElementById('frac-peso-saco').value) || 15;
    const totalKg = qtdSacos * pesoSaco;

    const prevSaco = document.getElementById('prev-frac-saco');
    const prevGranel = document.getElementById('prev-frac-granel');

    if (prevSaco) prevSaco.textContent = `- ${qtdSacos} un.`;
    if (prevGranel) prevGranel.textContent = `+ ${totalKg.toFixed(1)} kg`;
}

function executarFracionamento() {
    const sacoSelect = document.getElementById('frac-saco-select');
    const destinoSelect = document.getElementById('frac-destino-select');
    const qtdSacos = parseInt(document.getElementById('frac-qtd-sacos').value) || 1;
    const pesoSaco = parseFloat(document.getElementById('frac-peso-saco').value) || 15;

    if (!sacoSelect || !sacoSelect.value) {
        showToast('Selecione o saco de ração de origem.', 'warning');
        return;
    }

    if (!destinoSelect || !destinoSelect.value) {
        showToast('Selecione o produto a granel de destino.', 'warning');
        return;
    }

    if (qtdSacos <= 0 || pesoSaco <= 0) {
        showToast('Informe quantidades válidas para o fracionamento.', 'warning');
        return;
    }

    const products = DB.get(STORAGE_KEYS.PRODUCTS) || [];
    const sacoIndex = products.findIndex(p => p.id === sacoSelect.value);
    if (sacoIndex === -1) {
        showToast('Produto de origem não encontrado.', 'error');
        return;
    }

    const saco = products[sacoIndex];
    const saldoSaco = parseFloat(saco.estoque) || 0;

    if (saldoSaco < qtdSacos) {
        showToast(`Saldo insuficiente de sacos fechados! Você tem ${saldoSaco} un. e tentou abrir ${qtdSacos} un.`, 'warning');
        return;
    }

    const kgAdicional = qtdSacos * pesoSaco;
    let destinoProduto = null;

    if (destinoSelect.value === '__novo__') {
        // Criar produto a granel novo
        const precoVendaKg = saco.precoVenda > 0 ? (saco.precoVenda / pesoSaco * 1.3) : 10;
        const precoCustoKg = saco.precoCusto > 0 ? (saco.precoCusto / pesoSaco) : 5;
        const margemKg = precoVendaKg > 0 ? (((precoVendaKg - precoCustoKg) / precoVendaKg) * 100) : 50;

        destinoProduto = {
            id: 'prod_' + DB.generateId(),
            nome: `${saco.nome.replace(/\d+\s*kg/i, '').trim()} (A Granel kg)`,
            descricao: `Ração fracionada a partir de ${saco.nome}`,
            categoria: saco.categoria || 'Rações',
            sku: (saco.sku || 'RAC') + '-GRA',
            precoCusto: parseFloat(precoCustoKg.toFixed(2)),
            precoVenda: parseFloat(precoVendaKg.toFixed(2)),
            margem: parseFloat(margemKg.toFixed(2)),
            estoque: kgAdicional,
            estoqueMinimo: 5,
            unidade: 'kg',
            validade: saco.validade || '',
            fornecedor: saco.fornecedor || '',
            foto: ''
        };
        products.unshift(destinoProduto);
    } else {
        const destIndex = products.findIndex(p => p.id === destinoSelect.value);
        if (destIndex === -1) {
            showToast('Produto destino não encontrado.', 'error');
            return;
        }
        products[destIndex].estoque = (parseFloat(products[destIndex].estoque) || 0) + kgAdicional;
        destinoProduto = products[destIndex];
    }

    // Deduzir o saco
    saco.estoque = Math.max(0, saldoSaco - qtdSacos);
    products[sacoIndex] = saco;
    DB.save(STORAGE_KEYS.PRODUCTS, products);

    // Registrar movimentações de estoque
    const stockMovements = DB.get(STORAGE_KEYS.STOCK_MOVEMENTS) || [];
    stockMovements.unshift({
        id: 'mov_' + DB.generateId(),
        produtoId: saco.id,
        tipo: 'saida',
        quantidade: qtdSacos,
        motivo: `Fracionamento de saco para granel (${destinoProduto.nome})`,
        data: new Date().toISOString()
    });
    stockMovements.unshift({
        id: 'mov_' + DB.generateId(),
        produtoId: destinoProduto.id,
        tipo: 'entrada',
        quantidade: kgAdicional,
        motivo: `Entrada por abertura de ${qtdSacos} saco(s) de ${saco.nome}`,
        data: new Date().toISOString()
    });
    DB.save(STORAGE_KEYS.STOCK_MOVEMENTS, stockMovements);

    closeModal('modal-fracionamento');
    showToast(`Fracionamento concluído! -${qtdSacos} saco(s) e +${kgAdicional.toFixed(1)}kg a granel.`, 'success');

    renderEstoqueStats();
    renderProductsTable();
}

// === HISTÓRICO DE MOVIMENTAÇÕES DE ESTOQUE ===

function abrirModalHistoricoMovimentacoes() {
    const tbody = document.getElementById('historico-movimentacoes-tbody');
    if (!tbody) return;

    const movements = DB.get(STORAGE_KEYS.STOCK_MOVEMENTS) || [];
    const products = DB.get(STORAGE_KEYS.PRODUCTS) || [];

    if (movements.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align:center; padding:2rem; color:var(--text-secondary);">
                    Nenhuma movimentação registrada até o momento.
                </td>
            </tr>
        `;
        openModal('modal-historico-movimentacoes');
        return;
    }

    // Ordenar decrescente por data
    movements.sort((a, b) => new Date(b.data || 0) - new Date(a.data || 0));

    tbody.innerHTML = movements.slice(0, 50).map(m => {
        const prod = products.find(p => p.id === m.produtoId);
        const prodNome = prod ? prod.nome : 'Produto excluído';
        const unidade = prod ? (prod.unidade || 'un') : 'un';
        const isEntrada = m.tipo === 'entrada';

        const tipoBadge = isEntrada 
            ? `<span class="badge badge-success"><i data-lucide="arrow-down-left" style="width:12px;height:12px;vertical-align:middle;margin-right:2px;"></i> Entrada</span>`
            : `<span class="badge badge-danger"><i data-lucide="arrow-up-right" style="width:12px;height:12px;vertical-align:middle;margin-right:2px;"></i> Saída</span>`;

        const qtdFmt = unidade === 'kg' ? parseFloat(m.quantidade || 0).toFixed(1) : Math.round(parseFloat(m.quantidade || 0));

        return `
            <tr>
                <td style="font-size:0.85rem; color:var(--text-secondary);">
                    ${formatDateTime(m.data)}
                </td>
                <td>
                    <strong>${escapeHtml(prodNome)}</strong>
                </td>
                <td>
                    ${tipoBadge}
                </td>
                <td style="font-weight:600; color:${isEntrada ? 'var(--success)' : 'var(--danger)'};">
                    ${isEntrada ? '+' : '-'} ${qtdFmt} ${unidade}
                </td>
                <td style="font-size:0.85rem; color:var(--text-secondary);">
                    ${escapeHtml(m.motivo || '-')}
                </td>
            </tr>
        `;
    }).join('');

    openModal('modal-historico-movimentacoes');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// === Utilitário para Sanitização HTML ===
function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ==========================================
// MÓDULO: BALANÇO & CONFERÊNCIA DE INVENTÁRIO
// ==========================================

function abrirModalBalanco() {
    const tbody = document.getElementById('balanco-table-body');
    const searchInput = document.getElementById('balanco-search-input');
    if (searchInput) searchInput.value = '';

    const products = DB.get(STORAGE_KEYS.PRODUCTS) || [];
    products.sort((a, b) => a.nome.localeCompare(b.nome));

    if (tbody) {
        tbody.innerHTML = products.map(p => {
            const un = p.unidade || 'un';
            const est = parseFloat(p.estoque) || 0;
            const estFmt = un === 'kg' ? est.toFixed(1) : Math.round(est);
            return `
                <tr class="balanco-row" data-search="${escapeHtml((p.nome + ' ' + (p.sku || '')).toLowerCase())}">
                    <td><strong>${escapeHtml(p.nome)}</strong></td>
                    <td><code>${escapeHtml(p.sku || '-')}</code></td>
                    <td><span style="font-weight:600; color:var(--text-primary);">${estFmt} ${un}</span></td>
                    <td>
                        <input type="number" class="balanco-qtd-input" data-id="${p.id}" data-original="${est}" data-unidade="${un}" value="${estFmt}" min="0" step="${un === 'kg' ? '0.1' : '1'}" style="width: 110px; padding: 5px 8px; border: 1px solid var(--border); border-radius: 4px; font-weight:600;" oninput="calcularDiferencaBalanco(this)">
                    </td>
                    <td>
                        <span id="balanco-diff-${p.id}" class="badge" style="background:#f1f5f9; color:#64748b; font-size:0.78rem;">OK (0)</span>
                    </td>
                </tr>
            `;
        }).join('');
    }

    atualizarResumoDivergencias();
    openModal('modal-balanco');
}

function filtrarTabelaBalanco() {
    const input = document.getElementById('balanco-search-input');
    const term = (input ? input.value : '').toLowerCase().trim();
    const rows = document.querySelectorAll('.balanco-row');
    rows.forEach(r => {
        const search = r.dataset.search || '';
        r.style.display = !term || search.includes(term) ? '' : 'none';
    });
}

function calcularDiferencaBalanco(input) {
    const orig = parseFloat(input.dataset.original) || 0;
    const novo = parseFloat(input.value) || 0;
    const diff = novo - orig;
    const un = input.dataset.unidade || 'un';
    const badge = document.getElementById(`balanco-diff-${input.dataset.id}`);

    if (badge) {
        if (Math.abs(diff) < 0.001) {
            badge.style.background = '#f1f5f9';
            badge.style.color = '#64748b';
            badge.textContent = 'OK (0)';
        } else if (diff > 0) {
            badge.style.background = '#dcfce7';
            badge.style.color = '#15803d';
            badge.textContent = `+${un === 'kg' ? diff.toFixed(1) : Math.round(diff)} (Sobra)`;
        } else {
            badge.style.background = '#fee2e2';
            badge.style.color = '#b91c1c';
            badge.textContent = `${un === 'kg' ? diff.toFixed(1) : Math.round(diff)} (Perda/Falta)`;
        }
    }

    atualizarResumoDivergencias();
}

function atualizarResumoDivergencias() {
    const inputs = document.querySelectorAll('.balanco-qtd-input');
    let divergencias = 0;
    inputs.forEach(inp => {
        const orig = parseFloat(inp.dataset.original) || 0;
        const novo = parseFloat(inp.value) || 0;
        if (Math.abs(novo - orig) >= 0.001) {
            divergencias++;
        }
    });

    const elResumo = document.getElementById('balanco-resumo-divergencias');
    if (elResumo) {
        elResumo.innerHTML = divergencias > 0
            ? `<span style="color:#d97706;"><i data-lucide="alert-triangle" style="width:14px;height:14px;vertical-align:middle;"></i> ${divergencias} ${divergencias === 1 ? 'divergência identificada' : 'divergências identificadas'}</span>`
            : `<span style="color:#16a34a;"><i data-lucide="check" style="width:14px;height:14px;vertical-align:middle;"></i> Estoque 100% conciliado</span>`;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}

async function aplicarBalancoInventario() {
    const inputs = document.querySelectorAll('.balanco-qtd-input');
    const products = DB.get(STORAGE_KEYS.PRODUCTS) || [];
    const stockMovements = DB.get(STORAGE_KEYS.STOCK_MOVEMENTS) || [];
    let alterados = 0;

    inputs.forEach(inp => {
        const productId = inp.dataset.id;
        const orig = parseFloat(inp.dataset.original) || 0;
        const novo = parseFloat(inp.value) || 0;
        const diff = novo - orig;

        if (Math.abs(diff) >= 0.001) {
            const pIdx = products.findIndex(p => p.id === productId);
            if (pIdx !== -1) {
                products[pIdx].estoque = novo;
                alterados++;

                stockMovements.unshift({
                    id: 'mov_' + DB.generateId(),
                    produtoId: productId,
                    tipo: diff > 0 ? 'entrada' : 'saida',
                    quantidade: Math.abs(diff),
                    motivo: `Ajuste de Balanço / Inventário Físico (${diff > 0 ? 'Sobra de estoque' : 'Perda/Quebra identificada'})`,
                    data: new Date().toISOString()
                });
            }
        }
    });

    if (alterados === 0) {
        showToast('Nenhuma divergência foi alterada no balanço.', 'info');
        closeModal('modal-balanco');
        return;
    }

    DB.save(STORAGE_KEYS.PRODUCTS, products);
    DB.save(STORAGE_KEYS.STOCK_MOVEMENTS, stockMovements);

    closeModal('modal-balanco');
    showToast(`Balanço aplicado com sucesso! ${alterados} ${alterados === 1 ? 'produto atualizado' : 'produtos atualizados'}.`, 'success');

    renderEstoqueStats();
    renderProductsTable();

    if (typeof checkStockAlerts === 'function') {
        checkStockAlerts();
    }
}

// ==========================================
// MÓDULO: IMPORTAÇÃO E EXPORTAÇÃO CSV / EXCEL
// ==========================================

function abrirModalImportExport() {
    const inputCsv = document.getElementById('input-csv-produtos');
    const textCsv = document.getElementById('textarea-csv-produtos');
    if (inputCsv) inputCsv.value = '';
    if (textCsv) textCsv.value = '';
    switchImportExportTab('import');
    openModal('modal-import-export');
}

function switchImportExportTab(tab) {
    const paneImport = document.getElementById('pane-import-produtos');
    const paneExport = document.getElementById('pane-export-produtos');
    const btnImport = document.getElementById('tab-btn-import');
    const btnExport = document.getElementById('tab-btn-export');
    const footerImport = document.getElementById('footer-import-produtos');

    if (tab === 'import') {
        if (paneImport) paneImport.style.display = 'block';
        if (paneExport) paneExport.style.display = 'none';
        if (btnImport) {
            btnImport.style.fontWeight = '700';
            btnImport.style.borderBottom = '2px solid var(--primary)';
        }
        if (btnExport) {
            btnExport.style.fontWeight = '400';
            btnExport.style.borderBottom = 'none';
        }
        if (footerImport) footerImport.style.display = 'flex';
    } else {
        if (paneImport) paneImport.style.display = 'none';
        if (paneExport) paneExport.style.display = 'block';
        if (btnExport) {
            btnExport.style.fontWeight = '700';
            btnExport.style.borderBottom = '2px solid var(--primary)';
        }
        if (btnImport) {
            btnImport.style.fontWeight = '400';
            btnImport.style.borderBottom = 'none';
        }
        if (footerImport) footerImport.style.display = 'none';
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function baixarModeloPlanilhaProdutos() {
    const cabecalho = 'Nome;Categoria;SKU;PrecoCusto;PrecoVenda;Estoque;EstoqueMinimo;Unidade;Fornecedor;Validade\n';
    const linhasExemplo = [
        'Ração Golden Special Adulto Frango 15kg;Rações;RAC101;115.00;189.90;12;3;un;Distribuidora Pet;2026-12-31',
        'Petisco Bifinho Carne Cães 500g;Petiscos;PET102;6.80;15.90;24;6;pct;PetFood Dist;2026-11-20',
        'Shampoo Neutro Antipulgas 500ml;Higiene;HIG103;12.50;29.90;15;5;un;PetClean;2027-05-15',
        'Vermífugo Canino Plus 4 Comprimidos;Medicamentos;MED104;14.00;34.90;18;4;cx;VetFarma;2027-02-28',
        'Ração Granel Premium Frango Carne (kg);Rações;RAC-GRA02;7.20;14.90;30.0;8.0;kg;Distribuidora Pet;2026-10-15'
    ].join('\n');

    const csvContent = '\uFEFF' + cabecalho + linhasExemplo;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modelo_produtos_petshop.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Planilha modelo baixada com sucesso!', 'success');
}

function handleCsvFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        const textarea = document.getElementById('textarea-csv-produtos');
        if (textarea) textarea.value = text;
    };
    reader.readAsText(file, 'UTF-8');
}

function processarImportacaoProdutosCSV() {
    const textarea = document.getElementById('textarea-csv-produtos');
    const rawText = textarea ? textarea.value.trim() : '';

    if (!rawText) {
        showToast('Selecione um arquivo CSV ou cole os dados na caixa de texto.', 'warning');
        return;
    }

    const lines = rawText.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length < 2) {
        showToast('A planilha deve conter o cabeçalho e pelo menos 1 linha de produto.', 'warning');
        return;
    }

    const delimiter = lines[0].includes(';') ? ';' : ',';
    const products = DB.get(STORAGE_KEYS.PRODUCTS) || [];
    let importados = 0;
    let atualizados = 0;

    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, ''));
        if (cols.length < 5) continue;

        const nome = cols[0] || '';
        const categoria = cols[1] || 'Outros';
        const sku = cols[2] || '';
        const precoCusto = parseFloat((cols[3] || '0').replace(',', '.')) || 0;
        const precoVenda = parseFloat((cols[4] || '0').replace(',', '.')) || 0;
        const estoque = parseFloat((cols[5] || '0').replace(',', '.')) || 0;
        const estoqueMinimo = parseFloat((cols[6] || '5').replace(',', '.')) || 5;
        const unidade = cols[7] || (nome.toLowerCase().includes('granel') ? 'kg' : 'un');
        const fornecedor = cols[8] || '';
        const validade = cols[9] || '';

        if (!nome) continue;

        const margem = precoVenda > 0 ? parseFloat((((precoVenda - precoCusto) / precoVenda) * 100).toFixed(2)) : 0;

        // Se produto com mesmo SKU já existe, atualizar
        const existingIdx = sku ? products.findIndex(p => p.sku && p.sku.toLowerCase() === sku.toLowerCase()) : -1;

        if (existingIdx !== -1) {
            products[existingIdx] = {
                ...products[existingIdx],
                nome,
                categoria,
                precoCusto,
                precoVenda,
                margem,
                estoque,
                estoqueMinimo,
                unidade,
                fornecedor: fornecedor || products[existingIdx].fornecedor,
                validade: validade || products[existingIdx].validade
            };
            atualizados++;
        } else {
            products.push({
                id: 'prod_' + DB.generateId(),
                nome,
                descricao: '',
                categoria,
                sku: sku || 'SKU' + Math.floor(1000 + Math.random() * 9000),
                precoCusto,
                precoVenda,
                margem,
                estoque,
                estoqueMinimo,
                unidade,
                validade,
                fornecedor,
                foto: ''
            });
            importados++;
        }
    }

    if (importados === 0 && atualizados === 0) {
        showToast('Nenhum dado válido foi encontrado para importação.', 'error');
        return;
    }

    DB.save(STORAGE_KEYS.PRODUCTS, products);
    closeModal('modal-import-export');

    showToast(`Planilha processada! ${importados} produtos cadastrados e ${atualizados} atualizados.`, 'success');

    renderEstoqueStats();
    populateEstoqueCategories();
    renderProductsTable();

    if (typeof checkStockAlerts === 'function') {
        checkStockAlerts();
    }
}

function exportarEstoqueCSV() {
    const products = DB.get(STORAGE_KEYS.PRODUCTS) || [];

    if (products.length === 0) {
        showToast('Não há produtos cadastrados para exportar.', 'warning');
        return;
    }

    const cabecalho = 'Nome;Categoria;SKU;PrecoCusto;PrecoVenda;MargemPercentual;Estoque;EstoqueMinimo;Unidade;Fornecedor;Validade;StatusValidade\n';
    
    const rows = products.map(p => {
        const valInfo = getValidityInfo(p.validade);
        const custoFmt = (parseFloat(p.precoCusto) || 0).toFixed(2).replace('.', ',');
        const vendaFmt = (parseFloat(p.precoVenda) || 0).toFixed(2).replace('.', ',');
        const margemFmt = (parseFloat(p.margem) || 0).toFixed(2).replace('.', ',');
        const estoqueFmt = (parseFloat(p.estoque) || 0).toString().replace('.', ',');
        const minFmt = (parseFloat(p.estoqueMinimo) || 5).toString().replace('.', ',');

        return [
            `"${(p.nome || '').replace(/"/g, '""')}"`,
            `"${(p.categoria || '').replace(/"/g, '""')}"`,
            `"${p.sku || ''}"`,
            custoFmt,
            vendaFmt,
            margemFmt,
            estoqueFmt,
            minFmt,
            `"${p.unidade || 'un'}"`,
            `"${(p.fornecedor || '').replace(/"/g, '""')}"`,
            p.validade || '',
            valInfo.status
        ].join(';');
    }).join('\n');

    const csvContent = '\uFEFF' + cabecalho + rows;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const hoje = new Date().toISOString().split('T')[0];
    a.download = `estoque_petshop_${hoje}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Planilha do estoque exportada com sucesso!', 'success');
}

// ==========================================
// MÓDULO: PEDIDOS DE COMPRA, ESTOQUE A CAMINHO & FORNECEDORES
// ==========================================

let NovoPedidoState = {
    itens: []
};

let PedidoRecebendoAtual = null;

function abrirModalPedidosCompra() {
    switchPedidosTab('transito');
    openModal('modal-pedidos-compra');
}

function switchPedidosTab(tab) {
    const paneTransito = document.getElementById('pane-pedidos-transito');
    const paneRecebidos = document.getElementById('pane-pedidos-recebidos');
    const paneFornecedores = document.getElementById('pane-fornecedores');

    const btnTransito = document.getElementById('tab-pedidos-transito-btn');
    const btnRecebidos = document.getElementById('tab-pedidos-recebidos-btn');
    const btnFornecedores = document.getElementById('tab-fornecedores-btn');

    const resetBtn = (btn) => {
        if (!btn) return;
        btn.style.fontWeight = '400';
        btn.style.borderBottom = 'none';
    };

    resetBtn(btnTransito);
    resetBtn(btnRecebidos);
    resetBtn(btnFornecedores);

    if (paneTransito) paneTransito.style.display = tab === 'transito' ? 'block' : 'none';
    if (paneRecebidos) paneRecebidos.style.display = tab === 'recebidos' ? 'block' : 'none';
    if (paneFornecedores) paneFornecedores.style.display = tab === 'fornecedores' ? 'block' : 'none';

    if (tab === 'transito') {
        if (btnTransito) {
            btnTransito.style.fontWeight = '700';
            btnTransito.style.borderBottom = '2px solid var(--primary)';
        }
        renderPedidosTransito();
    } else if (tab === 'recebidos') {
        if (btnRecebidos) {
            btnRecebidos.style.fontWeight = '700';
            btnRecebidos.style.borderBottom = '2px solid var(--primary)';
        }
        renderPedidosRecebidos();
    } else if (tab === 'fornecedores') {
        if (btnFornecedores) {
            btnFornecedores.style.fontWeight = '700';
            btnFornecedores.style.borderBottom = '2px solid var(--primary)';
        }
        renderFornecedores();
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderPedidosTransito() {
    const tbody = document.getElementById('pedidos-transito-tbody');
    const countBadge = document.getElementById('count-tab-transito');
    if (!tbody) return;

    const purchaseOrders = DB.get(STORAGE_KEYS.PURCHASE_ORDERS) || [];
    const activeOrders = purchaseOrders.filter(po => po.status === 'em_transito' || po.status === 'atrasado');

    if (countBadge) countBadge.textContent = activeOrders.length;

    if (activeOrders.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align:center; padding:2.5rem; color:var(--text-secondary);">
                    <div style="font-size:1.5rem; margin-bottom:0.5rem;">🚚</div>
                    <strong>Nenhum pedido de compra em trânsito no momento.</strong>
                    <div style="font-size:0.85rem; margin-top:4px;">Faça um novo pedido ao fornecedor para programar entregas e acompanhar prazos.</div>
                </td>
            </tr>
        `;
        return;
    }

    const now = new Date();
    const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    tbody.innerHTML = activeOrders.map(po => {
        const prevMid = po.dataPrevista ? new Date(po.dataPrevista + (po.dataPrevista.includes('T') ? '' : 'T00:00:00')).getTime() : todayMid;
        const diffDays = Math.round((prevMid - todayMid) / (1000 * 60 * 60 * 24));
        const atrasado = diffDays < 0;

        let prazoHtml = '';
        if (atrasado) {
            prazoHtml = `<span class="badge badge-danger" style="font-weight:700;"><i data-lucide="alert-octagon" style="width:12px;height:12px;vertical-align:middle;margin-right:2px;"></i> Atrasado há ${Math.abs(diffDays)} dias</span><div style="font-size:0.75rem; color:#b91c1c; margin-top:2px;">Previsto: ${formatDate(po.dataPrevista)}</div>`;
        } else if (diffDays === 0) {
            prazoHtml = `<span class="badge badge-warning" style="font-weight:700;"><i data-lucide="clock" style="width:12px;height:12px;vertical-align:middle;margin-right:2px;"></i> Previsão para HOJE!</span><div style="font-size:0.75rem; color:#b45309; margin-top:2px;">${formatDate(po.dataPrevista)}</div>`;
        } else {
            prazoHtml = `<span class="badge badge-info" style="font-weight:700;"><i data-lucide="truck" style="width:12px;height:12px;vertical-align:middle;margin-right:2px;"></i> Chega em ${diffDays} dias</span><div style="font-size:0.75rem; color:var(--text-secondary); margin-top:2px;">Previsto: ${formatDate(po.dataPrevista)}</div>`;
        }

        const resumoItens = (po.itens || []).map(it => `${it.quantidade}x ${it.produtoNome}`).join(', ');

        return `
            <tr>
                <td>
                    <strong style="color:var(--text-primary); font-family:monospace;">${escapeHtml(po.numero)}</strong>
                    <div style="font-size:0.75rem; color:var(--text-secondary); max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${escapeHtml(resumoItens)}">
                        ${escapeHtml(resumoItens)}
                    </div>
                </td>
                <td>
                    <strong>${escapeHtml(po.fornecedorNome)}</strong>
                    <div style="font-size:0.75rem; color:var(--text-secondary);">${escapeHtml(po.fornecedorTelefone || '-')}</div>
                </td>
                <td style="font-size:0.85rem; color:var(--text-secondary);">
                    ${formatDate(po.dataPedido)}
                    <div style="font-size:0.72rem;">Prazo: ${po.prazoDias || 10} dias</div>
                </td>
                <td>
                    ${prazoHtml}
                </td>
                <td>
                    <span class="badge ${atrasado ? 'badge-danger' : 'badge-neutral'}">
                        ${atrasado ? 'Atrasado' : 'A Caminho'}
                    </span>
                </td>
                <td style="font-weight:700; color:var(--text-primary);">
                    ${formatCurrency(po.valorTotal || 0)}
                </td>
                <td style="text-align:right;">
                    <div style="display:flex; justify-content:flex-end; gap:0.4rem; align-items:center;">
                        ${atrasado || po.fornecedorTelefone ? `
                            <button class="btn btn-whatsapp btn-sm" onclick="cobrarPedidoAtrasadoWhatsApp('${po.id}')" title="Cobrar status de entrega no WhatsApp">
                                <i data-lucide="message-circle"></i> Cobrar
                            </button>
                        ` : ''}
                        <button class="btn btn-primary btn-sm" onclick="abrirModalReceberPedido('${po.id}')" style="background:#16a34a; border-color:#16a34a;" title="Dar entrada física na carga recebida">
                            <i data-lucide="package-check"></i> Receber Carga
                        </button>
                        <button class="btn-icon text-danger" onclick="cancelarPedidoCompra('${po.id}')" title="Cancelar pedido">
                            <i data-lucide="trash-2"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderPedidosRecebidos() {
    const tbody = document.getElementById('pedidos-recebidos-tbody');
    if (!tbody) return;

    const purchaseOrders = DB.get(STORAGE_KEYS.PURCHASE_ORDERS) || [];
    const receivedOrders = purchaseOrders.filter(po => po.status === 'recebido');

    if (receivedOrders.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center; padding:2rem; color:var(--text-secondary);">
                    Nenhum pedido de compra foi recebido ainda.
                </td>
            </tr>
        `;
        return;
    }

    receivedOrders.sort((a, b) => new Date(b.dataRecebimento || 0) - new Date(a.dataRecebimento || 0));

    tbody.innerHTML = receivedOrders.map(po => {
        const resumoItens = (po.itens || []).map(it => `${it.quantidade}x ${it.produtoNome}`).join(', ');
        return `
            <tr>
                <td><strong style="font-family:monospace;">${escapeHtml(po.numero)}</strong></td>
                <td><strong>${escapeHtml(po.fornecedorNome)}</strong></td>
                <td style="font-size:0.85rem; color:var(--text-secondary);">${formatDate(po.dataPedido)}</td>
                <td style="font-size:0.85rem; color:#15803d; font-weight:600;">
                    <i data-lucide="check" style="width:14px;height:14px;vertical-align:middle;"></i> ${formatDate(po.dataRecebimento)}
                </td>
                <td style="font-size:0.85rem; color:var(--text-secondary);">${escapeHtml(resumoItens)}</td>
                <td style="font-weight:700;">${formatCurrency(po.valorTotal || 0)}</td>
            </tr>
        `;
    }).join('');

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderFornecedores() {
    const tbody = document.getElementById('fornecedores-tbody');
    if (!tbody) return;

    const suppliers = DB.get(STORAGE_KEYS.SUPPLIERS) || [];

    if (suppliers.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center; padding:2rem; color:var(--text-secondary);">
                    Nenhum fornecedor cadastrado. Cadastre o primeiro parceiro acima!
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = suppliers.map(f => {
        const foneLimpo = (f.telefone || '').replace(/\D/g, '');
        return `
            <tr>
                <td><strong>${escapeHtml(f.nome)}</strong></td>
                <td>${escapeHtml(f.contato || '-')}</td>
                <td>
                    <a href="https://wa.me/55${foneLimpo}" target="_blank" style="color:#16a34a; text-decoration:none; font-weight:600; display:inline-flex; align-items:center; gap:4px;">
                        <i data-lucide="message-circle" style="width:14px;height:14px;"></i> ${escapeHtml(f.telefone || '-')}
                    </a>
                </td>
                <td><span class="badge badge-neutral">${f.prazoMedioDias || 7} dias</span></td>
                <td style="font-size:0.85rem; color:var(--text-secondary);">${escapeHtml(f.categorias || '-')}</td>
                <td style="text-align:right;">
                    <div style="display:flex; justify-content:flex-end; gap:0.4rem;">
                        <button class="btn-icon" onclick="abrirModalNovoFornecedor('${f.id}')" title="Editar fornecedor">
                            <i data-lucide="edit-3"></i>
                        </button>
                        <button class="btn-icon text-danger" onclick="excluirFornecedor('${f.id}')" title="Excluir fornecedor">
                            <i data-lucide="trash-2"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// === NOVO PEDIDO AO FORNECEDOR ===

function abrirModalNovoPedido(preselectedItems = null, preselectedFornecedor = null) {
    const selectForn = document.getElementById('novo-ped-fornecedor');
    const selectProd = document.getElementById('novo-ped-add-produto');
    const inputData = document.getElementById('novo-ped-data');
    const inputPrazo = document.getElementById('novo-ped-prazo-dias');

    const suppliers = DB.get(STORAGE_KEYS.SUPPLIERS) || [];
    const products = DB.get(STORAGE_KEYS.PRODUCTS) || [];

    if (selectForn) {
        selectForn.innerHTML = '<option value="">Selecione a distribuidora parceira...</option>' +
            suppliers.map(s => `<option value="${s.id}">${escapeHtml(s.nome)} (Prazo médio: ${s.prazoMedioDias || 7}d)</option>`).join('');
        if (preselectedFornecedor) selectForn.value = preselectedFornecedor;
    }

    if (selectProd) {
        products.sort((a, b) => a.nome.localeCompare(b.nome));
        selectProd.innerHTML = '<option value="">Selecione o produto a encomendar...</option>' +
            products.map(p => `<option value="${p.id}">${escapeHtml(p.nome)} (${p.sku || '-'})</option>`).join('');
    }

    if (inputData) inputData.value = new Date().toISOString().split('T')[0];
    if (inputPrazo) inputPrazo.value = 10;

    NovoPedidoState.itens = preselectedItems ? [...preselectedItems] : [];

    onPedidoFornecedorChange();
    onPedidoItemProdutoChange();
    calcularPrevisaoEntregaPedido();
    renderNovoPedidoItens();

    openModal('modal-novo-pedido');
}

function onPedidoFornecedorChange() {
    const selectForn = document.getElementById('novo-ped-fornecedor');
    const repNome = document.getElementById('novo-ped-rep-nome');
    const repFone = document.getElementById('novo-ped-rep-fone');
    const inputPrazo = document.getElementById('novo-ped-prazo-dias');

    if (!selectForn) return;
    const fornId = selectForn.value;
    const suppliers = DB.get(STORAGE_KEYS.SUPPLIERS) || [];
    const forn = suppliers.find(s => s.id === fornId);

    if (forn) {
        if (repNome) repNome.textContent = forn.contato || 'Representante';
        if (repFone) repFone.textContent = forn.telefone || '-';
        if (inputPrazo && forn.prazoMedioDias) inputPrazo.value = forn.prazoMedioDias;
    } else {
        if (repNome) repNome.textContent = '-';
        if (repFone) repFone.textContent = '-';
    }
    calcularPrevisaoEntregaPedido();
}

function calcularPrevisaoEntregaPedido() {
    const inputData = document.getElementById('novo-ped-data');
    const inputPrazo = document.getElementById('novo-ped-prazo-dias');
    const badgePrevisao = document.getElementById('novo-ped-previsao-badge');

    if (!inputData || !inputPrazo || !badgePrevisao) return;

    const dataBaseStr = inputData.value || new Date().toISOString().split('T')[0];
    const dias = parseInt(inputPrazo.value, 10) || 10;

    const targetDate = new Date(dataBaseStr + 'T00:00:00');
    targetDate.setDate(targetDate.getDate() + dias);

    const dataFmt = formatDate(targetDate.toISOString().split('T')[0]);
    badgePrevisao.textContent = `${dataFmt} (em ${dias} dias)`;
}

function onPedidoItemProdutoChange() {
    const selectProd = document.getElementById('novo-ped-add-produto');
    const inputCusto = document.getElementById('novo-ped-add-custo');
    if (!selectProd || !inputCusto) return;

    const prodId = selectProd.value;
    const products = DB.get(STORAGE_KEYS.PRODUCTS) || [];
    const prod = products.find(p => p.id === prodId);

    if (prod) {
        inputCusto.value = (parseFloat(prod.precoCusto) || 0).toFixed(2);
    }
}

function adicionarItemAoPedido() {
    const selectProd = document.getElementById('novo-ped-add-produto');
    const inputQtd = document.getElementById('novo-ped-add-qtd');
    const inputCusto = document.getElementById('novo-ped-add-custo');

    if (!selectProd || !selectProd.value) {
        showToast('Selecione um produto para adicionar.', 'warning');
        return;
    }

    const prodId = selectProd.value;
    const qtd = parseFloat(inputQtd ? inputQtd.value : 1) || 1;
    const custo = parseFloat(inputCusto ? inputCusto.value : 0) || 0;

    const products = DB.get(STORAGE_KEYS.PRODUCTS) || [];
    const prod = products.find(p => p.id === prodId);
    if (!prod) return;

    // Verificar se já existe na lista
    const existing = NovoPedidoState.itens.find(it => it.produtoId === prodId);
    if (existing) {
        existing.quantidade += qtd;
        existing.custoUnitario = custo;
        existing.subtotal = existing.quantidade * custo;
    } else {
        NovoPedidoState.itens.push({
            produtoId: prod.id,
            produtoNome: prod.nome,
            unidade: prod.unidade || 'un',
            quantidade: qtd,
            custoUnitario: custo,
            subtotal: qtd * custo
        });
    }

    renderNovoPedidoItens();
    showToast(`"${prod.nome}" adicionado ao pedido`, 'info');
}

function removerItemDoPedido(idx) {
    NovoPedidoState.itens.splice(idx, 1);
    renderNovoPedidoItens();
}

function renderNovoPedidoItens() {
    const tbody = document.getElementById('novo-ped-itens-tbody');
    const displayTotal = document.getElementById('novo-ped-total-display');
    if (!tbody) return;

    if (NovoPedidoState.itens.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-secondary); padding:1rem;">Nenhum item adicionado ainda</td></tr>`;
        if (displayTotal) displayTotal.textContent = 'R$ 0,00';
        return;
    }

    let totalGeral = 0;
    tbody.innerHTML = NovoPedidoState.itens.map((it, idx) => {
        totalGeral += it.subtotal;
        return `
            <tr>
                <td><strong>${escapeHtml(it.produtoNome)}</strong></td>
                <td>${it.quantidade} ${it.unidade}</td>
                <td>${formatCurrency(it.custoUnitario)}</td>
                <td style="font-weight:700;">${formatCurrency(it.subtotal)}</td>
                <td style="text-align:right;">
                    <button type="button" class="btn-icon text-danger" onclick="removerItemDoPedido(${idx})">
                        <i data-lucide="x"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    if (displayTotal) displayTotal.textContent = formatCurrency(totalGeral);
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function salvarNovoPedido(enviarWhatsApp = false) {
    const selectForn = document.getElementById('novo-ped-fornecedor');
    const inputData = document.getElementById('novo-ped-data');
    const inputPrazo = document.getElementById('novo-ped-prazo-dias');
    const inputForma = document.getElementById('novo-ped-forma-pagamento');
    const inputObs = document.getElementById('novo-ped-obs');

    if (!selectForn || !selectForn.value) {
        showToast('Selecione o fornecedor do pedido.', 'warning');
        return;
    }

    if (NovoPedidoState.itens.length === 0) {
        showToast('Adicione pelo menos 1 produto ao pedido.', 'warning');
        return;
    }

    const suppliers = DB.get(STORAGE_KEYS.SUPPLIERS) || [];
    const forn = suppliers.find(s => s.id === selectForn.value);
    const fornNome = forn ? forn.nome : 'Fornecedor';
    const fornFone = forn ? forn.telefone : '';

    const dataPedido = inputData.value || new Date().toISOString().split('T')[0];
    const prazoDias = parseInt(inputPrazo.value, 10) || 10;

    const targetDate = new Date(dataPedido + 'T00:00:00');
    targetDate.setDate(targetDate.getDate() + prazoDias);
    const dataPrevista = targetDate.toISOString().split('T')[0];

    const valorTotal = NovoPedidoState.itens.reduce((acc, it) => acc + (it.subtotal || 0), 0);

    const numeroPedido = 'PED-' + Math.floor(100 + Math.random() * 900);

    const novoPedido = {
        id: 'po_' + DB.generateId(),
        numero: numeroPedido,
        fornecedorId: forn ? forn.id : '',
        fornecedorNome: fornNome,
        fornecedorTelefone: fornFone,
        dataPedido,
        prazoDias,
        dataPrevista,
        status: 'em_transito',
        itens: [...NovoPedidoState.itens],
        valorTotal,
        formaPagamento: inputForma ? inputForma.value : 'Boleto 28 dias',
        observacoes: inputObs ? inputObs.value : '',
        dataRecebimento: null
    };

    const purchaseOrders = DB.get(STORAGE_KEYS.PURCHASE_ORDERS) || [];
    purchaseOrders.unshift(novoPedido);
    DB.save(STORAGE_KEYS.PURCHASE_ORDERS, purchaseOrders);

    closeModal('modal-novo-pedido');
    showToast(`Pedido #${numeroPedido} registrado! Estoque a caminho atualizado.`, 'success');

    if (enviarWhatsApp && fornFone) {
        enviarMensagemPedidoWhatsApp(novoPedido, forn);
    }

    renderEstoqueStats();
    renderProductsTable();
    abrirModalPedidosCompra();
}

function enviarMensagemPedidoWhatsApp(pedido, forn) {
    const foneLimpo = (pedido.fornecedorTelefone || (forn ? forn.telefone : '') || '').replace(/\D/g, '');
    const dataFmt = formatDate(pedido.dataPrevista);

    const listaItens = (pedido.itens || []).map(it => `• ${it.quantidade} ${it.unidade} de ${it.produtoNome} (R$ ${it.custoUnitario.toFixed(2)})`).join('\n');

    const texto = `Olá ${forn && forn.contato ? forn.contato : pedido.fornecedorNome}! Tudo bem?\n\n` +
        `Segue nosso *Pedido de Compra #${pedido.numero}*:\n\n` +
        `${listaItens}\n\n` +
        `*Valor Total Estimado:* ${formatCurrency(pedido.valorTotal)}\n` +
        `*Previsão de Entrega Combinada:* ${dataFmt} (${pedido.prazoDias} dias)\n` +
        `${pedido.formaPagamento ? '*Condição de Pagamento:* ' + pedido.formaPagamento + '\n' : ''}` +
        `\nPoderia confirmar o recebimento e o prazo de entrega? Obrigado!`;

    window.open(`https://wa.me/55${foneLimpo}?text=${encodeURIComponent(texto)}`, '_blank');
}

function cobrarPedidoAtrasadoWhatsApp(pedidoId) {
    const purchaseOrders = DB.get(STORAGE_KEYS.PURCHASE_ORDERS) || [];
    const po = purchaseOrders.find(p => p.id === pedidoId);
    if (!po) return;

    const foneLimpo = (po.fornecedorTelefone || '').replace(/\D/g, '');
    const dataFmt = formatDate(po.dataPrevista);

    const texto = `Olá ${po.fornecedorNome}! Tudo bem?\n\n` +
        `Estamos aguardando o nosso *Pedido de Compra #${po.numero}*, que tinha previsão de entrega para *${dataFmt}*.\n\n` +
        `Poderia nos informar a posição do despacho ou o rastreio da transportadora? Nossos clientes já estão aguardando esses produtos. Obrigado!`;

    window.open(`https://wa.me/55${foneLimpo}?text=${encodeURIComponent(texto)}`, '_blank');
}

async function cancelarPedidoCompra(pedidoId) {
    const proceed = await confirmDialog('Deseja realmente cancelar este pedido de compra? Ele deixará de constar como "a caminho" no estoque.');
    if (!proceed) return;

    let purchaseOrders = DB.get(STORAGE_KEYS.PURCHASE_ORDERS) || [];
    purchaseOrders = purchaseOrders.filter(p => p.id !== pedidoId);
    DB.save(STORAGE_KEYS.PURCHASE_ORDERS, purchaseOrders);

    showToast('Pedido cancelado com sucesso.', 'info');
    renderPedidosTransito();
    renderEstoqueStats();
    renderProductsTable();
}

// === RECEBIMENTO DE MERCADORIA / CHECK-IN DE CARGA ===

function abrirModalReceberPedido(pedidoId) {
    const purchaseOrders = DB.get(STORAGE_KEYS.PURCHASE_ORDERS) || [];
    const po = purchaseOrders.find(p => p.id === pedidoId);
    if (!po) return;

    PedidoRecebendoAtual = po;

    const elNum = document.getElementById('rec-ped-numero');
    const elForn = document.getElementById('rec-ped-fornecedor');
    const inputVenc = document.getElementById('rec-ped-vencimento');
    const tbody = document.getElementById('rec-ped-itens-tbody');

    if (elNum) elNum.textContent = po.numero;
    if (elForn) elForn.textContent = `Fornecedor: ${po.fornecedorNome}`;

    // Vencimento padrão: 30 dias após hoje
    if (inputVenc) {
        const d = new Date();
        d.setDate(d.getDate() + 30);
        inputVenc.value = d.toISOString().split('T')[0];
    }

    if (tbody) {
        tbody.innerHTML = (po.itens || []).map(it => {
            return `
                <tr>
                    <td><strong>${escapeHtml(it.produtoNome)}</strong></td>
                    <td>${it.quantidade} ${it.unidade}</td>
                    <td>
                        <input type="number" class="rec-qtd-input" data-prod-id="${it.produtoId}" value="${it.quantidade}" min="0" step="${it.unidade === 'kg' ? '0.1' : '1'}" style="width:90px; padding:4px 6px; border:1px solid var(--border); border-radius:4px; font-weight:700;">
                    </td>
                    <td>
                        <input type="date" class="rec-validade-input" data-prod-id="${it.produtoId}" style="width:125px; padding:3px 5px; font-size:0.8rem; border:1px solid var(--border); border-radius:4px;">
                    </td>
                </tr>
            `;
        }).join('');
    }

    openModal('modal-receber-pedido');
}

function toggleRecPedDespesa() {
    const chk = document.getElementById('rec-ped-gerar-despesa');
    const fields = document.getElementById('rec-ped-despesa-fields');
    if (chk && fields) {
        fields.style.display = chk.checked ? 'block' : 'none';
    }
}

function confirmarRecebimentoCarga() {
    if (!PedidoRecebendoAtual) return;

    const po = PedidoRecebendoAtual;
    const qtdInputs = document.querySelectorAll('.rec-qtd-input');
    const valInputs = document.querySelectorAll('.rec-validade-input');

    const products = DB.get(STORAGE_KEYS.PRODUCTS) || [];
    const stockMovements = DB.get(STORAGE_KEYS.STOCK_MOVEMENTS) || [];

    let totalRecebidoCusto = 0;

    qtdInputs.forEach((inp, idx) => {
        const pId = inp.dataset.prodId;
        const qtdRecebida = parseFloat(inp.value) || 0;
        const valInput = valInputs[idx];
        const novaValidade = valInput ? valInput.value : '';

        const prod = products.find(p => p.id === pId);
        if (prod && qtdRecebida > 0) {
            prod.estoque = (parseFloat(prod.estoque) || 0) + qtdRecebida;
            if (novaValidade) {
                prod.validade = novaValidade;
            }

            const custoUnit = parseFloat(prod.precoCusto) || 0;
            totalRecebidoCusto += qtdRecebida * custoUnit;

            stockMovements.unshift({
                id: 'mov_' + DB.generateId(),
                produtoId: prod.id,
                tipo: 'entrada',
                quantidade: qtdRecebida,
                custoUnitario: custoUnit,
                custoTotal: qtdRecebida * custoUnit,
                motivo: `Recebimento de Carga: Pedido #${po.numero} (${po.fornecedorNome})`,
                data: new Date().toISOString()
            });
        }
    });

    DB.save(STORAGE_KEYS.PRODUCTS, products);
    DB.save(STORAGE_KEYS.STOCK_MOVEMENTS, stockMovements);

    // Atualizar status do pedido para 'recebido'
    const purchaseOrders = DB.get(STORAGE_KEYS.PURCHASE_ORDERS) || [];
    const poIndex = purchaseOrders.findIndex(p => p.id === po.id);
    if (poIndex !== -1) {
        purchaseOrders[poIndex].status = 'recebido';
        purchaseOrders[poIndex].dataRecebimento = new Date().toISOString();
        DB.save(STORAGE_KEYS.PURCHASE_ORDERS, purchaseOrders);
    }

    // Gerar despesa no financeiro se solicitado
    const chkDespesa = document.getElementById('rec-ped-gerar-despesa');
    if (chkDespesa && chkDespesa.checked && totalRecebidoCusto > 0) {
        const inputVenc = document.getElementById('rec-ped-vencimento');
        const inputForma = document.getElementById('rec-ped-forma');
        const vencimento = inputVenc && inputVenc.value ? inputVenc.value : new Date().toISOString().split('T')[0];
        const forma = inputForma ? inputForma.value : 'Boleto';

        const expenses = DB.get(STORAGE_KEYS.EXPENSES) || [];
        expenses.unshift({
            id: DB.generateId(),
            descricao: `Fatura Pedido #${po.numero} - ${po.fornecedorNome}`,
            categoria: 'Estoque / Mercadorias',
            valor: totalRecebidoCusto,
            data: vencimento,
            recorrente: false,
            status: 'pendente',
            formaPagamento: forma
        });
        DB.save(STORAGE_KEYS.EXPENSES, expenses);
    }

    closeModal('modal-receber-pedido');
    showToast(`Carga do Pedido #${po.numero} descarregada! Estoque abastecido com sucesso.`, 'success');

    renderEstoqueStats();
    renderProductsTable();
    renderPedidosTransito();
}

// === GESTÃO DE FORNECEDORES ===

function abrirModalNovoFornecedor(fornecedorId = null) {
    const inputId = document.getElementById('forn-id');
    const inputNome = document.getElementById('forn-nome');
    const inputContato = document.getElementById('forn-contato');
    const inputTelefone = document.getElementById('forn-telefone');
    const inputPrazo = document.getElementById('forn-prazo');
    const inputCategorias = document.getElementById('forn-categorias');
    const inputObs = document.getElementById('forn-obs');
    const modalTitle = document.getElementById('forn-modal-title');

    if (fornecedorId) {
        const suppliers = DB.get(STORAGE_KEYS.SUPPLIERS) || [];
        const f = suppliers.find(s => s.id === fornecedorId);
        if (f) {
            if (inputId) inputId.value = f.id;
            if (inputNome) inputNome.value = f.nome;
            if (inputContato) inputContato.value = f.contato || '';
            if (inputTelefone) inputTelefone.value = f.telefone || '';
            if (inputPrazo) inputPrazo.value = f.prazoMedioDias || 7;
            if (inputCategorias) inputCategorias.value = f.categorias || '';
            if (inputObs) inputObs.value = f.observacoes || '';
            if (modalTitle) modalTitle.textContent = 'Editar Fornecedor';
        }
    } else {
        if (inputId) inputId.value = '';
        if (inputNome) inputNome.value = '';
        if (inputContato) inputContato.value = '';
        if (inputTelefone) inputTelefone.value = '';
        if (inputPrazo) inputPrazo.value = 7;
        if (inputCategorias) inputCategorias.value = '';
        if (inputObs) inputObs.value = '';
        if (modalTitle) modalTitle.textContent = 'Novo Fornecedor / Distribuidora';
    }

    openModal('modal-novo-fornecedor');
}

function salvarFornecedor() {
    const inputId = document.getElementById('forn-id');
    const inputNome = document.getElementById('forn-nome');
    const inputContato = document.getElementById('forn-contato');
    const inputTelefone = document.getElementById('forn-telefone');
    const inputPrazo = document.getElementById('forn-prazo');
    const inputCategorias = document.getElementById('forn-categorias');
    const inputObs = document.getElementById('forn-obs');

    const nome = inputNome ? inputNome.value.trim() : '';
    const telefone = inputTelefone ? inputTelefone.value.trim() : '';

    if (!nome || !telefone) {
        showToast('Razão social e telefone/WhatsApp são obrigatórios.', 'warning');
        return;
    }

    const suppliers = DB.get(STORAGE_KEYS.SUPPLIERS) || [];
    const id = inputId && inputId.value ? inputId.value : null;

    if (id) {
        const idx = suppliers.findIndex(s => s.id === id);
        if (idx !== -1) {
            suppliers[idx] = {
                ...suppliers[idx],
                nome,
                contato: inputContato ? inputContato.value.trim() : '',
                telefone,
                prazoMedioDias: parseInt(inputPrazo ? inputPrazo.value : 7, 10) || 7,
                categorias: inputCategorias ? inputCategorias.value.trim() : '',
                observacoes: inputObs ? inputObs.value.trim() : ''
            };
            showToast('Fornecedor atualizado com sucesso!', 'success');
        }
    } else {
        suppliers.push({
            id: 'forn_' + DB.generateId(),
            nome,
            contato: inputContato ? inputContato.value.trim() : '',
            telefone,
            prazoMedioDias: parseInt(inputPrazo ? inputPrazo.value : 7, 10) || 7,
            categorias: inputCategorias ? inputCategorias.value.trim() : '',
            observacoes: inputObs ? inputObs.value.trim() : ''
        });
        showToast('Fornecedor cadastrado com sucesso!', 'success');
    }

    DB.save(STORAGE_KEYS.SUPPLIERS, suppliers);
    closeModal('modal-novo-fornecedor');
    renderFornecedores();
}

async function excluirFornecedor(fornecedorId) {
    const proceed = await confirmDialog('Deseja realmente excluir este fornecedor da agenda?');
    if (!proceed) return;

    let suppliers = DB.get(STORAGE_KEYS.SUPPLIERS) || [];
    suppliers = suppliers.filter(s => s.id !== fornecedorId);
    DB.save(STORAGE_KEYS.SUPPLIERS, suppliers);

    showToast('Fornecedor removido com sucesso.', 'info');
    renderFornecedores();
}
