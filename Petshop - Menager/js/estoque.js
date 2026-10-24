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
    let valorTotalEstoque = 0;
    let totalBaixo = 0;
    let totalEsgotado = 0;
    let totalVencendoOuVencido = 0;

    products.forEach(p => {
        const estoque = parseFloat(p.estoque) || 0;
        const estoqueMin = parseFloat(p.estoqueMinimo) || 5;
        const precoVenda = parseFloat(p.precoVenda) || 0;

        valorTotalEstoque += estoque * precoVenda;

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

    const elTotal = document.getElementById('stat-total-produtos');
    const elValor = document.getElementById('stat-valor-estoque');
    const elBaixo = document.getElementById('stat-estoque-baixo');
    const elEsgotado = document.getElementById('stat-esgotados');
    const elVencendo = document.getElementById('stat-vencendo-mes');

    if (elTotal) elTotal.textContent = totalProdutos;
    if (elValor) elValor.textContent = formatCurrency(valorTotalEstoque);
    if (elBaixo) elBaixo.textContent = totalBaixo;
    if (elEsgotado) elEsgotado.textContent = totalEsgotado;
    if (elVencendo) elVencendo.textContent = totalVencendoOuVencido;
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

    // 4. Renderização das linhas
    tbody.innerHTML = paginated.data.map(product => {
        const estoque = parseFloat(product.estoque) || 0;
        const estoqueMin = parseFloat(product.estoqueMinimo) || 5;
        const precoCusto = parseFloat(product.precoCusto) || 0;
        const precoVenda = parseFloat(product.precoVenda) || 0;
        const unidade = product.unidade || 'un';

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

    updateMovementPreview();
    openModal('modal-movimentacao');
}

function handleMovementProductChange() {
    updateMovementPreview();
}

function updateMovementPreview() {
    const select = document.getElementById('mov-product-select');
    const tipoSelect = document.getElementById('mov-tipo');
    const qtdInput = document.getElementById('mov-quantidade');

    const prevAtual = document.getElementById('prev-estoque-atual');
    const prevOp = document.getElementById('prev-operacao');
    const prevNovo = document.getElementById('prev-novo-estoque');

    if (!select || !tipoSelect || !qtdInput) return;

    const productId = select.value;
    const tipo = tipoSelect.value;
    const qtd = parseFloat(qtdInput.value) || 0;

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

    if (tipo === 'entrada') {
        product.estoque = estoqueAtual + quantidade;
    } else {
        product.estoque = Math.max(0, estoqueAtual - quantidade);
    }
    products[productIndex] = product;
    DB.save(STORAGE_KEYS.PRODUCTS, products);

    const stockMovements = DB.get(STORAGE_KEYS.STOCK_MOVEMENTS) || [];
    stockMovements.unshift({
        id: 'mov_' + DB.generateId(),
        produtoId: product.id,
        tipo: tipo,
        quantidade: quantidade,
        motivo: motivo,
        data: new Date().toISOString()
    });
    DB.save(STORAGE_KEYS.STOCK_MOVEMENTS, stockMovements);

    closeModal('modal-movimentacao');
    showToast(`Movimentação de ${tipo === 'entrada' ? 'entrada' : 'saída'} registrada com sucesso!`, 'success');

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

    produtosRepor.forEach(p => {
        const est = parseFloat(p.estoque) || 0;
        const min = parseFloat(p.estoqueMinimo) || 5;
        const custo = parseFloat(p.precoCusto) || 0;
        const unidade = p.unidade || 'un';

        // Sugestão: repor o dobro do mínimo subtraído do que já tem
        const qtdSugerida = Math.max(Math.ceil((min * 2) - est), min);
        const subtotal = qtdSugerida * custo;
        totalGeral += subtotal;

        html += `
            <tr>
                <td>
                    <strong>${escapeHtml(p.nome)}</strong>
                    <div style="font-size:0.75rem; color:var(--text-secondary);">${escapeHtml(p.categoria || '')} ${p.sku ? '• SKU: ' + p.sku : ''}</div>
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
