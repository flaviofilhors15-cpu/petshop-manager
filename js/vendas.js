// ==========================================
// PetShop Manager - Módulo de Vendas (PDV)
// Controle de Caixa, Carrinho e Histórico
// ==========================================

// Estado da aplicação de Vendas
const VendasState = {
    cart: [],
    selectedClientId: '',
    discountValue: 0,
    discountType: 'percentual', // 'percentual' ou 'valor'
    paymentMethod: 'Pix',
    receivedAmount: 0,
    activeTab: 'nova-venda',
    productSearch: '',
    productCategory: '',
    historySearch: '',
    historyStartDate: '',
    historyEndDate: '',
    historyPayment: '',
    historyPage: 1,
    historyPerPage: 10
};

// === Inicialização do Módulo ===
document.addEventListener('DOMContentLoaded', () => {
    initVendas();
});

function initVendas() {
    populateCategoryFilter();
    populateClientSelect();
    renderProductsGrid();
    renderTodayStats();
    renderCart();
    setupPdvKeyboardShortcuts();

    // Re-renderizar ícones da biblioteca Lucide
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// Configura atalhos de teclado e leitor de código de barras
function setupPdvKeyboardShortcuts() {
    // F2: Foca na busca/código de barras
    // F4: Finaliza a venda
    // ESC: Limpa o carrinho ou fecha modal
    window.addEventListener('keydown', (e) => {
        // Se modal estiver aberto e apertar ESC, o app.js já cuida
        if (e.key === 'F2') {
            e.preventDefault();
            switchVendasTab('nova-venda');
            const searchInput = document.getElementById('pdv-search-input');
            if (searchInput) {
                searchInput.focus();
                searchInput.select();
            }
        } else if (e.key === 'F4') {
            e.preventDefault();
            if (VendasState.activeTab === 'nova-venda') {
                finalizarVenda();
            }
        } else if (e.key === 'Escape') {
            // Se carrinho tiver itens e nenhum modal aberto
            const modalOpen = document.querySelector('.modal-overlay.active');
            if (!modalOpen && VendasState.cart.length > 0) {
                clearCart();
            }
        }
    });

    // Enter no campo de busca/código de barras adiciona automaticamente o produto
    const searchInput = document.getElementById('pdv-search-input');
    if (searchInput) {
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                processarBipCodigoBarras(searchInput.value.trim());
            }
        });
    }
}

// Trata leitura rápida de código de barras ou SKU exato
function processarBipCodigoBarras(term) {
    if (!term) return;
    const products = DB.get(STORAGE_KEYS.PRODUCTS) || [];
    const termClean = term.toLowerCase();

    // Procura exato por SKU ou código de barras
    let match = products.find(p => p.sku && p.sku.toLowerCase() === termClean);
    if (!match) {
        // Procura por nome exato
        match = products.find(p => p.nome && p.nome.toLowerCase() === termClean);
    }
    if (!match) {
        // Pega o primeiro que contenha o termo
        match = products.find(p => (p.sku && p.sku.toLowerCase().includes(termClean)) || (p.nome && p.nome.toLowerCase().includes(termClean)));
    }

    if (match) {
        addToCart(match.id, 1);
        showToast(`⚡ Adicionado via leitor: ${match.nome}`, 'success');
        const searchInput = document.getElementById('pdv-search-input');
        if (searchInput) {
            searchInput.value = '';
            VendasState.productSearch = '';
            renderProductsGrid();
            searchInput.focus();
        }
    } else {
        showToast(`Nenhum produto encontrado com o código "${term}".`, 'warning');
    }
}

// Alternar entre abas 'nova-venda' e 'historico'
function switchVendasTab(tabId) {
    VendasState.activeTab = tabId;

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
    });

    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.toggle('active', pane.id === `tab-${tabId}`);
    });

    if (tabId === 'historico') {
        VendasState.historyPage = 1;
        renderSalesHistory();
    } else {
        renderProductsGrid();
    }

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// === Carregar Filtros e Clientes ===
function populateCategoryFilter() {
    const select = document.getElementById('pdv-category-select');
    if (!select) return;

    const settings = DB.get(STORAGE_KEYS.SETTINGS) || {};
    const categories = settings.categoriasProdutos || ['Rações', 'Petiscos', 'Brinquedos', 'Higiene', 'Acessórios', 'Medicamentos'];

    // Obter categorias também de produtos existentes para garantir cobertura
    const products = DB.get(STORAGE_KEYS.PRODUCTS) || [];
    products.forEach(p => {
        if (p.categoria && !categories.includes(p.categoria)) {
            categories.push(p.categoria);
        }
    });

    select.innerHTML = '<option value="">Todas as Categorias</option>' +
        categories.map(cat => `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`).join('');
}

function populateClientSelect() {
    const select = document.getElementById('cart-client-select');
    if (!select) return;

    const clients = DB.get(STORAGE_KEYS.CLIENTS) || [];
    clients.sort((a, b) => a.nome.localeCompare(b.nome));

    let options = '<option value="">Cliente Avulso (Não identificado)</option>';
    options += clients.map(c => `
        <option value="${c.id}">${escapeHtml(c.nome)}${c.telefone ? ' - ' + formatPhone(c.telefone) : ''}</option>
    `).join('');

    select.innerHTML = options;
}

// Atualizar estatísticas rápidas do dia
function renderTodayStats() {
    const sales = DB.get(STORAGE_KEYS.SALES) || [];
    const todayStr = new Date().toISOString().split('T')[0];

    const todaySales = sales.filter(s => {
        if (!s.data) return false;
        return s.data.startsWith(todayStr);
    });

    const totalCount = todaySales.length;
    const totalRevenue = todaySales.reduce((acc, s) => acc + (parseFloat(s.total) || 0), 0);

    const countElem = document.getElementById('stat-vendas-hoje');
    const revElem = document.getElementById('stat-faturamento-hoje');

    if (countElem) {
        countElem.textContent = `${totalCount} ${totalCount === 1 ? 'venda hoje' : 'vendas hoje'}`;
    }
    if (revElem) {
        revElem.textContent = formatCurrency(totalRevenue);
    }
}

// === Renderização do Catálogo de Produtos PDV ===
function renderProductsGrid() {
    const grid = document.getElementById('pdv-products-grid');
    const countElem = document.getElementById('pdv-products-count');
    if (!grid) return;

    const products = DB.get(STORAGE_KEYS.PRODUCTS) || [];

    // Filtros de busca e categoria
    const searchTerm = VendasState.productSearch.toLowerCase().trim();
    const selectedCategory = VendasState.productCategory;

    const filtered = products.filter(product => {
        const matchesName = product.nome && product.nome.toLowerCase().includes(searchTerm);
        const matchesSku = product.sku && product.sku.toLowerCase().includes(searchTerm);
        const matchesDesc = product.descricao && product.descricao.toLowerCase().includes(searchTerm);
        const matchesSearch = !searchTerm || matchesName || matchesSku || matchesDesc;

        const matchesCat = !selectedCategory || product.categoria === selectedCategory;

        return matchesSearch && matchesCat;
    });

    if (countElem) {
        countElem.textContent = `${filtered.length} ${filtered.length === 1 ? 'produto encontrado' : 'produtos encontrados'}`;
    }

    if (filtered.length === 0) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1; padding: 3rem 1rem;">
                <i data-lucide="package-search"></i>
                <p>Nenhum produto encontrado</p>
                <span>Tente buscar por outro termo ou selecione outra categoria</span>
            </div>
        `;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    grid.innerHTML = filtered.map(product => {
        const unidade = product.unidade || 'un';
        const isOutOfStock = product.estoque <= 0;
        const isLowStock = !isOutOfStock && product.estoque <= (product.estoqueMinimo || 5);
        const saldoFmt = unidade === 'kg' ? (parseFloat(product.estoque) || 0).toFixed(1) : Math.round(parseFloat(product.estoque) || 0);

        let stockBadge = '';
        if (isOutOfStock) {
            stockBadge = `<span class="badge badge-danger" style="font-size: 0.7rem;">Esgotado</span>`;
        } else if (isLowStock) {
            stockBadge = `<span class="badge badge-warning" style="font-size: 0.7rem;">${saldoFmt} ${unidade} (Baixo)</span>`;
        } else {
            stockBadge = `<span class="badge badge-neutral" style="font-size: 0.7rem;">${saldoFmt} ${unidade}</span>`;
        }

        return `
            <div class="product-card-pdv ${isOutOfStock ? 'out-of-stock' : ''}" 
                 onclick="${isOutOfStock ? 'notifyOutOfStock()' : `addToCart('${product.id}')`}">
                <div class="product-img">
                    <i data-lucide="${getCategoryIcon(product.categoria)}" style="width: 28px; height: 28px; color: var(--primary);"></i>
                </div>
                <div class="product-sku">${escapeHtml(product.sku || 'SKU')}</div>
                <div class="product-name" title="${escapeHtml(product.nome)}">${escapeHtml(product.nome)}</div>
                <div class="product-price">${formatCurrency(product.precoVenda)}</div>
                <div class="product-stock" style="margin-top: 0.4rem;">
                    ${stockBadge}
                </div>
            </div>
        `;
    }).join('');

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function getCategoryIcon(categoria) {
    if (!categoria) return 'package';
    const cat = categoria.toLowerCase();
    if (cat.includes('ração') || cat.includes('racao') || cat.includes('alimento')) return 'bone';
    if (cat.includes('petisco')) return 'cookie';
    if (cat.includes('brinquedo')) return 'smile';
    if (cat.includes('higiene') || cat.includes('limpeza')) return 'sparkles';
    if (cat.includes('acessório') || cat.includes('acessorio') || cat.includes('coleira')) return 'tag';
    if (cat.includes('medicamento') || cat.includes('farmácia') || cat.includes('remedio')) return 'activity';
    return 'package';
}

function notifyOutOfStock() {
    showToast('Este produto está sem estoque disponível no momento!', 'warning');
}

// Eventos de Busca e Filtro de Produtos
function handleProductSearch() {
    const input = document.getElementById('pdv-search-input');
    VendasState.productSearch = input ? input.value : '';
    renderProductsGrid();
}

function handleCategoryFilter() {
    const select = document.getElementById('pdv-category-select');
    VendasState.productCategory = select ? select.value : '';
    renderProductsGrid();
}

function handleClientChange() {
    const select = document.getElementById('cart-client-select');
    VendasState.selectedClientId = select ? select.value : '';
}

// === Gerenciamento do Carrinho de Compras ===
function addToCart(productId) {
    const products = DB.get(STORAGE_KEYS.PRODUCTS) || [];
    const product = products.find(p => p.id === productId);

    if (!product) {
        showToast('Produto não encontrado!', 'error');
        return;
    }

    if (product.estoque <= 0) {
        showToast(`O produto "${product.nome}" está esgotado!`, 'warning');
        return;
    }

    const cartItem = VendasState.cart.find(item => item.produtoId === productId);

    if (cartItem) {
        if (cartItem.quantidade + 1 > product.estoque) {
            showToast(`Estoque máximo atingido para "${product.nome}" (${product.estoque} un.)`, 'warning');
            return;
        }
        cartItem.quantidade += 1;
        cartItem.subtotal = cartItem.quantidade * cartItem.precoUnitario;
    } else {
        VendasState.cart.push({
            produtoId: product.id,
            nome: product.nome,
            quantidade: 1,
            precoUnitario: parseFloat(product.precoVenda) || 0,
            subtotal: parseFloat(product.precoVenda) || 0,
            maxEstoque: product.estoque
        });
    }

    renderCart();
    showToast(`"${product.nome}" adicionado ao carrinho`, 'info');
}

function updateCartItemQuantity(productId, delta) {
    const products = DB.get(STORAGE_KEYS.PRODUCTS) || [];
    const product = products.find(p => p.id === productId);
    const cartIndex = VendasState.cart.findIndex(item => item.produtoId === productId);

    if (cartIndex === -1) return;

    const item = VendasState.cart[cartIndex];
    const newQuantity = item.quantidade + delta;

    if (newQuantity <= 0) {
        // Remover item do carrinho se quantidade for menor ou igual a zero
        VendasState.cart.splice(cartIndex, 1);
        showToast(`Item "${item.nome}" removido do carrinho`, 'info');
    } else {
        const availableStock = product ? product.estoque : item.maxEstoque;
        if (newQuantity > availableStock) {
            showToast(`Estoque máximo atingido para "${item.nome}" (${availableStock} un.)`, 'warning');
            return;
        }
        item.quantidade = newQuantity;
        item.subtotal = item.quantidade * item.precoUnitario;
    }

    renderCart();
}

function removeFromCart(productId) {
    const item = VendasState.cart.find(i => i.produtoId === productId);
    VendasState.cart = VendasState.cart.filter(i => i.produtoId !== productId);
    if (item) {
        showToast(`"${item.nome}" removido do carrinho`, 'info');
    }
    renderCart();
}

async function clearCart() {
    if (VendasState.cart.length === 0) return;

    const confirmed = await confirmDialog('Deseja realmente esvaziar todos os itens do carrinho?');
    if (confirmed) {
        VendasState.cart = [];
        VendasState.discountValue = 0;
        VendasState.receivedAmount = 0;

        const discInput = document.getElementById('cart-discount-value');
        if (discInput) discInput.value = 0;

        const recInput = document.getElementById('cart-received-amount');
        if (recInput) recInput.value = '';

        renderCart();
        showToast('Carrinho esvaziado com sucesso', 'info');
    }
}

// Atualizar cálculos e interface do Carrinho
function renderCart() {
    const container = document.getElementById('cart-items-container');
    const countBadge = document.getElementById('cart-items-count');
    const subtotalDisplay = document.getElementById('cart-subtotal-display');
    const discountCalculatedDisplay = document.getElementById('cart-discount-calculated');
    const totalDisplay = document.getElementById('cart-total-display');
    const btnFinalizar = document.getElementById('btn-finalizar-venda');

    if (!container) return;

    const totalItems = VendasState.cart.reduce((acc, item) => acc + item.quantidade, 0);
    if (countBadge) {
        countBadge.textContent = `${totalItems} ${totalItems === 1 ? 'item' : 'itens'}`;
    }

    if (VendasState.cart.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="padding: 2.5rem 1rem;">
                <i data-lucide="shopping-cart"></i>
                <p style="font-size: 0.95rem;">Carrinho Vazio</p>
                <span style="font-size: 0.8rem;">Clique nos produtos ao lado para iniciar a venda</span>
            </div>
        `;
        if (subtotalDisplay) subtotalDisplay.textContent = formatCurrency(0);
        if (discountCalculatedDisplay) discountCalculatedDisplay.textContent = '- R$ 0,00';
        if (totalDisplay) totalDisplay.textContent = formatCurrency(0);
        if (btnFinalizar) btnFinalizar.disabled = true;

        updateTrocoCalculation(0);
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    if (btnFinalizar) btnFinalizar.disabled = false;

    // Renderizar lista de itens
    container.innerHTML = VendasState.cart.map(item => `
        <div class="cart-item">
            <div class="cart-item-info">
                <div class="cart-item-name">${escapeHtml(item.nome)}</div>
                <div class="cart-item-price">${formatCurrency(item.precoUnitario)} un. &bull; Subtotal: <strong>${formatCurrency(item.subtotal)}</strong></div>
            </div>
            <div class="cart-item-qty">
                <button type="button" onclick="updateCartItemQuantity('${item.produtoId}', -1)" title="Diminuir quantidade">&minus;</button>
                <span>${item.quantidade}</span>
                <button type="button" onclick="updateCartItemQuantity('${item.produtoId}', 1)" title="Aumentar quantidade">&plus;</button>
            </div>
            <button class="btn-icon" onclick="removeFromCart('${item.produtoId}')" title="Remover item" style="margin-left: 0.5rem; color: var(--danger);">
                <i data-lucide="trash-2" style="width: 16px; height: 16px;"></i>
            </button>
        </div>
    `).join('');

    // Calcular Subtotal
    const subtotal = VendasState.cart.reduce((acc, item) => acc + item.subtotal, 0);

    // Calcular Desconto
    let discountAmount = 0;
    if (VendasState.discountType === 'percentual') {
        discountAmount = subtotal * (Math.max(0, VendasState.discountValue) / 100);
    } else {
        discountAmount = Math.max(0, VendasState.discountValue);
    }
    discountAmount = Math.min(discountAmount, subtotal); // Desconto não pode exceder subtotal

    const total = Math.max(0, subtotal - discountAmount);

    if (subtotalDisplay) subtotalDisplay.textContent = formatCurrency(subtotal);
    if (discountCalculatedDisplay) discountCalculatedDisplay.textContent = `- ${formatCurrency(discountAmount)}`;
    if (totalDisplay) totalDisplay.textContent = formatCurrency(total);

    updateTrocoCalculation(total);

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// Manipulação do desconto
function handleDiscountChange() {
    const valInput = document.getElementById('cart-discount-value');
    const typeSelect = document.getElementById('cart-discount-type');

    VendasState.discountValue = parseFloat(valInput ? valInput.value : 0) || 0;
    VendasState.discountType = typeSelect ? typeSelect.value : 'percentual';

    if (VendasState.discountValue < 0) {
        VendasState.discountValue = 0;
        if (valInput) valInput.value = 0;
    }

    if (VendasState.discountType === 'percentual' && VendasState.discountValue > 100) {
        VendasState.discountValue = 100;
        if (valInput) valInput.value = 100;
    }

    renderCart();
}

// Manipulação da forma de pagamento
function handlePaymentMethodChange() {
    const select = document.getElementById('cart-payment-method');
    VendasState.paymentMethod = select ? select.value : 'Pix';

    const trocoWrapper = document.getElementById('troco-wrapper');
    if (trocoWrapper) {
        trocoWrapper.style.display = VendasState.paymentMethod === 'Dinheiro' ? 'block' : 'none';
    }

    renderCart();
}

function handleReceivedAmountChange() {
    const input = document.getElementById('cart-received-amount');
    VendasState.receivedAmount = parseFloat(input ? input.value : 0) || 0;

    const subtotal = VendasState.cart.reduce((acc, item) => acc + item.subtotal, 0);
    let discountAmount = 0;
    if (VendasState.discountType === 'percentual') {
        discountAmount = subtotal * (Math.max(0, VendasState.discountValue) / 100);
    } else {
        discountAmount = Math.max(0, VendasState.discountValue);
    }
    discountAmount = Math.min(discountAmount, subtotal);
    const total = Math.max(0, subtotal - discountAmount);

    updateTrocoCalculation(total);
}

function updateTrocoCalculation(total) {
    const trocoBox = document.getElementById('troco-box');
    const trocoDisplay = document.getElementById('troco-display');

    if (!trocoBox || !trocoDisplay) return;

    if (VendasState.paymentMethod !== 'Dinheiro' || total === 0) {
        trocoDisplay.textContent = 'R$ 0,00';
        return;
    }

    const troco = Math.max(0, VendasState.receivedAmount - total);
    trocoDisplay.textContent = formatCurrency(troco);

    if (VendasState.receivedAmount > 0 && VendasState.receivedAmount < total) {
        trocoBox.style.borderLeftColor = 'var(--danger)';
        trocoBox.innerHTML = `Falta pagar: <strong style="color: var(--danger);">${formatCurrency(total - VendasState.receivedAmount)}</strong>`;
    } else {
        trocoBox.style.borderLeftColor = 'var(--primary)';
        trocoBox.innerHTML = `Troco a devolver: <strong>${formatCurrency(troco)}</strong>`;
    }
}

// === FINALIZAR VENDA (PDV) ===
async function finalizarVenda() {
    if (VendasState.cart.length === 0) {
        showToast('O carrinho está vazio! Adicione produtos antes de finalizar.', 'warning');
        return;
    }

    // Recarregar produtos para conferência de estoque em tempo real
    const products = DB.get(STORAGE_KEYS.PRODUCTS) || [];
    for (const item of VendasState.cart) {
        const prod = products.find(p => p.id === item.produtoId);
        if (!prod || prod.estoque < item.quantidade) {
            showToast(`Estoque insuficiente para o produto "${item.nome}". Disponível: ${prod ? prod.estoque : 0} un.`, 'error');
            return;
        }
    }

    // Cálculos finais
    const subtotal = VendasState.cart.reduce((acc, item) => acc + item.subtotal, 0);
    let discountAmount = 0;
    if (VendasState.discountType === 'percentual') {
        discountAmount = subtotal * (Math.max(0, VendasState.discountValue) / 100);
    } else {
        discountAmount = Math.max(0, VendasState.discountValue);
    }
    discountAmount = Math.min(discountAmount, subtotal);
    const total = Math.max(0, subtotal - discountAmount);

    // Validação de pagamento em dinheiro
    if (VendasState.paymentMethod === 'Dinheiro' && VendasState.receivedAmount > 0 && VendasState.receivedAmount < total) {
        const proceed = await confirmDialog(`O valor recebido (${formatCurrency(VendasState.receivedAmount)}) é menor que o total (${formatCurrency(total)}). Deseja continuar mesmo assim?`);
        if (!proceed) return;
    }

    // Confirmação final do usuário
    const confirmMsg = `Confirmar venda no valor de ${formatCurrency(total)} via ${VendasState.paymentMethod}?`;
    const confirmed = await confirmDialog(confirmMsg);
    if (!confirmed) return;

    // 1. Criar Objeto da Venda
    const nowIso = new Date().toISOString();
    const newSaleId = 'venda_' + DB.generateId();

    const saleRecord = {
        id: newSaleId,
        data: nowIso,
        clienteId: VendasState.selectedClientId || null,
        itens: VendasState.cart.map(item => ({
            produtoId: item.produtoId,
            nome: item.nome,
            quantidade: item.quantidade,
            precoUnitario: item.precoUnitario,
            subtotal: item.subtotal
        })),
        subtotal: subtotal,
        desconto: VendasState.discountValue,
        descontoTipo: VendasState.discountType,
        total: total,
        formaPagamento: VendasState.paymentMethod,
        valorRecebido: VendasState.paymentMethod === 'Dinheiro' && VendasState.receivedAmount > 0 ? VendasState.receivedAmount : total,
        troco: VendasState.paymentMethod === 'Dinheiro' && VendasState.receivedAmount > total ? (VendasState.receivedAmount - total) : 0
    };

    // 2. Persistir Venda em ps_sales
    const sales = DB.get(STORAGE_KEYS.SALES) || [];
    sales.unshift(saleRecord);
    DB.save(STORAGE_KEYS.SALES, sales);

    // 3. Criar e Persistir Receita em ps_revenues
    const clients = DB.get(STORAGE_KEYS.CLIENTS) || [];
    const client = clients.find(c => c.id === saleRecord.clienteId);
    const clientName = client ? client.nome : 'Cliente Avulso';

    const revenues = DB.get(STORAGE_KEYS.REVENUES) || [];
    const revenueRecord = {
        id: 'rec_' + DB.generateId(),
        data: nowIso.split('T')[0],
        descricao: `Venda #${saleRecord.id.slice(-6)} - ${clientName}`,
        categoria: 'Produto',
        valor: saleRecord.total,
        formaPagamento: saleRecord.formaPagamento,
        referencia: saleRecord.id
    };
    revenues.unshift(revenueRecord);
    DB.save(STORAGE_KEYS.REVENUES, revenues);

    // 4. Abater Estoque dos Produtos e Registrar ps_stock_movements
    const stockMovements = DB.get(STORAGE_KEYS.STOCK_MOVEMENTS) || [];

    for (const item of saleRecord.itens) {
        const prod = products.find(p => p.id === item.produtoId);
        if (prod) {
            prod.estoque = Math.max(0, prod.estoque - item.quantidade);
        }

        stockMovements.unshift({
            id: 'mov_' + DB.generateId(),
            produtoId: item.produtoId,
            tipo: 'saida',
            quantidade: item.quantidade,
            motivo: `Venda PDV #${saleRecord.id.slice(-6)}`,
            data: nowIso
        });
    }

    DB.save(STORAGE_KEYS.PRODUCTS, products);
    DB.save(STORAGE_KEYS.STOCK_MOVEMENTS, stockMovements);

    // 5. Atualizar Alertas de Estoque no Header (função global de app.js se existir)
    if (typeof checkStockAlerts === 'function') {
        checkStockAlerts();
    }

    // 6. Limpar Carrinho e Estado
    VendasState.cart = [];
    VendasState.discountValue = 0;
    VendasState.receivedAmount = 0;

    const discInput = document.getElementById('cart-discount-value');
    if (discInput) discInput.value = 0;

    const recInput = document.getElementById('cart-received-amount');
    if (recInput) recInput.value = '';

    renderCart();
    renderProductsGrid();
    renderTodayStats();

    showToast('Venda finalizada com sucesso!', 'success');

    // 7. Abrir Comprovante de Venda automaticamente para visualização/impressão
    openReceiptModal(saleRecord.id);
}

// === HISTÓRICO DE VENDAS ===
function renderSalesHistory() {
    const tbody = document.getElementById('history-table-body');
    const infoElem = document.getElementById('history-table-info');
    if (!tbody) return;

    const sales = DB.get(STORAGE_KEYS.SALES) || [];
    const clients = DB.get(STORAGE_KEYS.CLIENTS) || [];

    // Mapear clientes para acesso rápido por ID
    const clientMap = {};
    clients.forEach(c => { clientMap[c.id] = c; });

    // Filtragem
    const searchTerm = VendasState.historySearch.toLowerCase().trim();
    const startDate = VendasState.historyStartDate;
    const endDate = VendasState.historyEndDate;
    const paymentFilter = VendasState.historyPayment;

    const filtered = sales.filter(sale => {
        const client = clientMap[sale.clienteId];
        const clientName = client ? client.nome.toLowerCase() : 'cliente avulso';
        const saleId = sale.id.toLowerCase();

        const matchesSearch = !searchTerm || clientName.includes(searchTerm) || saleId.includes(searchTerm);

        let matchesDate = true;
        const saleDateStr = sale.data ? sale.data.split('T')[0] : '';
        if (startDate && saleDateStr < startDate) matchesDate = false;
        if (endDate && saleDateStr > endDate) matchesDate = false;

        const matchesPayment = !paymentFilter || sale.formaPagamento === paymentFilter;

        return matchesSearch && matchesDate && matchesPayment;
    });

    // Ordenar vendas da mais recente para a mais antiga
    filtered.sort((a, b) => new Date(b.data || 0) - new Date(a.data || 0));

    // Paginação
    const paginated = paginate(filtered, VendasState.historyPage, VendasState.historyPerPage);

    if (infoElem) {
        infoElem.textContent = `Mostrando ${paginated.data.length} de ${filtered.length} ${filtered.length === 1 ? 'venda' : 'vendas'}`;
    }

    if (paginated.data.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8">
                    <div class="empty-state" style="padding: 2.5rem 1rem;">
                        <i data-lucide="inbox"></i>
                        <p>Nenhuma venda encontrada</p>
                        <span>Ajuste os filtros de data ou busca para visualizar outras vendas</span>
                    </div>
                </td>
            </tr>
        `;
        renderPagination('history-pagination', 1, 1, 'changeHistoryPage');
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    tbody.innerHTML = paginated.data.map(sale => {
        const client = clientMap[sale.clienteId];
        const clientName = client ? client.nome : 'Cliente Avulso';

        // Resumo de itens
        const itemsCount = sale.itens ? sale.itens.reduce((acc, i) => acc + i.quantidade, 0) : 0;
        const itemsSummary = sale.itens ? sale.itens.map(i => `${i.quantidade}x ${i.nome}`).join(', ') : '';

        // Badge de pagamento
        let paymentBadgeClass = 'badge-neutral';
        if (sale.formaPagamento === 'Pix') paymentBadgeClass = 'badge-success';
        else if (sale.formaPagamento === 'Dinheiro') paymentBadgeClass = 'badge-info';
        else if (sale.formaPagamento && sale.formaPagamento.includes('Crédito')) paymentBadgeClass = 'badge-warning';

        return `
            <tr>
                <td>
                    <div style="font-weight: 500;">${formatDateTime(sale.data)}</div>
                </td>
                <td>
                    <span style="font-family: monospace; font-size: 0.85rem; background: var(--bg); padding: 2px 6px; border-radius: 4px;">
                        #${escapeHtml(sale.id.slice(-6).toUpperCase())}
                    </span>
                </td>
                <td>
                    <div style="font-weight: 500;">${escapeHtml(clientName)}</div>
                    ${client && client.telefone ? `<small class="text-muted">${formatPhone(client.telefone)}</small>` : ''}
                </td>
                <td>
                    <div title="${escapeHtml(itemsSummary)}" style="max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        <span class="badge badge-neutral" style="margin-right: 4px;">${itemsCount} un.</span>
                        <span>${escapeHtml(itemsSummary)}</span>
                    </div>
                </td>
                <td>
                    <div>${formatCurrency(sale.subtotal || sale.total)}</div>
                    ${sale.desconto > 0 ? `<small style="color: var(--danger);">- ${sale.descontoTipo === 'percentual' ? sale.desconto + '%' : formatCurrency(sale.desconto)}</small>` : ''}
                </td>
                <td>
                    <strong style="color: var(--primary); font-size: 0.95rem;">${formatCurrency(sale.total)}</strong>
                </td>
                <td>
                    <span class="badge ${paymentBadgeClass}">${escapeHtml(sale.formaPagamento || 'Outro')}</span>
                </td>
                <td style="text-align: right;">
                    <button class="btn btn-secondary btn-sm" onclick="openReceiptModal('${sale.id}')" title="Ver e imprimir comprovante">
                        <i data-lucide="receipt"></i>
                        Comprovante
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    renderPagination('history-pagination', paginated.currentPage, paginated.totalPages, 'changeHistoryPage');

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// Manipuladores de Filtros do Histórico
function handleHistorySearch() {
    const input = document.getElementById('history-search-input');
    VendasState.historySearch = input ? input.value : '';
    VendasState.historyPage = 1;
    renderSalesHistory();
}

function handleHistoryDateFilter() {
    const startInput = document.getElementById('history-date-start');
    const endInput = document.getElementById('history-date-end');
    VendasState.historyStartDate = startInput ? startInput.value : '';
    VendasState.historyEndDate = endInput ? endInput.value : '';
    VendasState.historyPage = 1;
    renderSalesHistory();
}

function handleHistoryPaymentFilter() {
    const select = document.getElementById('history-payment-filter');
    VendasState.historyPayment = select ? select.value : '';
    VendasState.historyPage = 1;
    renderSalesHistory();
}

function clearHistoryFilters() {
    VendasState.historySearch = '';
    VendasState.historyStartDate = '';
    VendasState.historyEndDate = '';
    VendasState.historyPayment = '';
    VendasState.historyPage = 1;

    const sInput = document.getElementById('history-search-input');
    const dStart = document.getElementById('history-date-start');
    const dEnd = document.getElementById('history-date-end');
    const pSelect = document.getElementById('history-payment-filter');

    if (sInput) sInput.value = '';
    if (dStart) dStart.value = '';
    if (dEnd) dEnd.value = '';
    if (pSelect) pSelect.value = '';

    renderSalesHistory();
}

// Função global para troca de página de histórico
window.changeHistoryPage = function(newPage) {
    VendasState.historyPage = newPage;
    renderSalesHistory();
};

// === COMPROVANTE DE VENDA (IMPRESSÃO) ===
function openReceiptModal(saleId) {
    const sales = DB.get(STORAGE_KEYS.SALES) || [];
    const sale = sales.find(s => s.id === saleId);
    if (!sale) {
        showToast('Venda não encontrada para emissão de comprovante', 'error');
        return;
    }

    const settings = DB.get(STORAGE_KEYS.SETTINGS) || {};
    const clients = DB.get(STORAGE_KEYS.CLIENTS) || [];
    const client = clients.find(c => c.id === sale.clienteId);

    // Preencher dados da empresa
    const companyName = document.getElementById('receipt-company-name');
    const companyInfo = document.getElementById('receipt-company-info');
    if (companyName) {
        companyName.textContent = settings.nomeFantasia || 'PetShop Manager';
    }
    if (companyInfo) {
        companyInfo.innerHTML = `
            ${settings.cnpj ? 'CNPJ: ' + escapeHtml(settings.cnpj) + '<br>' : ''}
            ${settings.endereco ? escapeHtml(settings.endereco) + '<br>' : ''}
            ${settings.telefone ? 'Tel: ' + formatPhone(settings.telefone) : ''}
        `;
    }

    // Preencher detalhes da venda
    const receiptSaleId = document.getElementById('receipt-sale-id');
    const receiptSaleDate = document.getElementById('receipt-sale-date');
    const receiptSaleClient = document.getElementById('receipt-sale-client');

    if (receiptSaleId) receiptSaleId.textContent = `#${sale.id.slice(-6).toUpperCase()}`;
    if (receiptSaleDate) receiptSaleDate.textContent = formatDateTime(sale.data);
    if (receiptSaleClient) {
        receiptSaleClient.textContent = client ? `${client.nome}${client.cpf ? ' (CPF: ' + client.cpf + ')' : ''}` : 'Consumidor Final (Não identificado)';
    }

    // Preencher tabela de itens
    const itemsTbody = document.getElementById('receipt-items-tbody');
    if (itemsTbody) {
        itemsTbody.innerHTML = (sale.itens || []).map(item => `
            <tr>
                <td>${item.quantidade}x ${escapeHtml(item.nome)}</td>
                <td style="text-align: right;">${formatCurrency(item.precoUnitario)}</td>
                <td style="text-align: right;">${formatCurrency(item.subtotal)}</td>
            </tr>
        `).join('');
    }

    // Totais e Desconto
    const subtotalElem = document.getElementById('receipt-subtotal');
    const discountRow = document.getElementById('receipt-discount-row');
    const discountElem = document.getElementById('receipt-discount');
    const totalElem = document.getElementById('receipt-total');
    const paymentElem = document.getElementById('receipt-payment-method');

    const subtotal = sale.subtotal || sale.total;
    if (subtotalElem) subtotalElem.textContent = formatCurrency(subtotal);

    if (sale.desconto > 0) {
        if (discountRow) discountRow.style.display = 'flex';
        let discountFormatted = '';
        if (sale.descontoTipo === 'percentual') {
            const descValor = subtotal * (sale.desconto / 100);
            discountFormatted = `- ${sale.desconto}% (${formatCurrency(descValor)})`;
        } else {
            discountFormatted = `- ${formatCurrency(sale.desconto)}`;
        }
        if (discountElem) discountElem.textContent = discountFormatted;
    } else {
        if (discountRow) discountRow.style.display = 'none';
    }

    if (totalElem) totalElem.textContent = formatCurrency(sale.total);
    if (paymentElem) paymentElem.textContent = sale.formaPagamento || 'Pix';

    // Detalhes de dinheiro e troco
    const cashDetails = document.getElementById('receipt-cash-details');
    const receivedElem = document.getElementById('receipt-received-amount');
    const trocoElem = document.getElementById('receipt-troco-amount');

    if (sale.formaPagamento === 'Dinheiro' && sale.valorRecebido != null) {
        if (cashDetails) cashDetails.style.display = 'block';
        if (receivedElem) receivedElem.textContent = formatCurrency(sale.valorRecebido);
        if (trocoElem) trocoElem.textContent = formatCurrency(sale.troco || 0);
    } else {
        if (cashDetails) cashDetails.style.display = 'none';
    }

    openModal('modal-comprovante');
}

function printReceipt() {
    window.print();
}

// === Função Utilitária para Sanitização de HTML ===
function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
