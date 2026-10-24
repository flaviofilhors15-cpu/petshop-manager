// ========================================================
// PetShop Manager - Módulo de Clientes e Pets (clientes.js)
// Operações CRUD completas, filtros, busca, paginação e perfil
// ========================================================

// Estado do módulo
let paginaAtual = 1;
const itensPorPagina = 10;
let termoBusca = '';
let filtroPets = '';
let filtroEspecie = '';
let colunaOrdenacao = 'nome';
let direcaoOrdenacao = 'asc'; // 'asc' ou 'desc'

// Variáveis de controle de modais
let clientePerfilAtual = null;
let fotoPetAtual = '';

// ========================================================
// Inicialização
// ========================================================
document.addEventListener('DOMContentLoaded', () => {
    // Sincronizar campo de busca global do header com a busca desta página
    const globalSearch = document.getElementById('global-search');
    if (globalSearch) {
        globalSearch.addEventListener('input', (e) => {
            const inputBusca = document.getElementById('filtro-busca');
            if (inputBusca) {
                inputBusca.value = e.target.value;
                termoBusca = e.target.value.toLowerCase().trim();
                paginaAtual = 1;
                carregarClientes();
            }
        });
    }

    // Carregar dados e renderizar
    carregarEstatisticasGerais();
    carregarClientes();
});

// ========================================================
// Utilitários e Helpers
// ========================================================
function escapeHTML(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Calcular idade legível do pet
function calcularIdadePet(dataNascimento) {
    if (!dataNascimento) return 'Não informada';
    const nasc = new Date(dataNascimento + (dataNascimento.includes('T') ? '' : 'T00:00:00'));
    if (isNaN(nasc.getTime())) return 'Não informada';

    const hoje = new Date();
    let anos = hoje.getFullYear() - nasc.getFullYear();
    let meses = hoje.getMonth() - nasc.getMonth();

    if (hoje.getDate() < nasc.getDate()) {
        meses--;
    }
    if (meses < 0) {
        anos--;
        meses += 12;
    }

    if (anos > 0) {
        if (meses > 0) {
            return `${anos} ${anos === 1 ? 'ano' : 'anos'} e ${meses} ${meses === 1 ? 'mês' : 'meses'}`;
        }
        return `${anos} ${anos === 1 ? 'ano' : 'anos'}`;
    } else if (meses > 0) {
        return `${meses} ${meses === 1 ? 'mês' : 'meses'}`;
    } else {
        const diffTempo = Math.abs(hoje - nasc);
        const diffDias = Math.floor(diffTempo / (1000 * 60 * 60 * 24));
        return `${diffDias} ${diffDias === 1 ? 'dia' : 'dias'}`;
    }
}

// Retorna ícone representativo de acordo com a espécie
function getIconeEspecie(especie) {
    if (!especie) return '🐾';
    const esp = especie.toLowerCase();
    if (esp.includes('cão') || esp.includes('cachorro')) return '🐶';
    if (esp.includes('gato')) return '🐱';
    if (esp.includes('ave') || esp.includes('pássaro')) return '🦜';
    if (esp.includes('roedor') || esp.includes('coelho')) return '🐰';
    return '🐾';
}

// Retorna badge formatado de status de agendamento
function getBadgeStatusAgendamento(status) {
    switch (status) {
        case 'concluido':
            return '<span class="badge badge-success"><span class="status-dot concluido"></span>Concluído</span>';
        case 'em_andamento':
            return '<span class="badge badge-info"><span class="status-dot em_andamento"></span>Em Andamento</span>';
        case 'cancelado':
            return '<span class="badge badge-danger"><span class="status-dot cancelado"></span>Cancelado</span>';
        case 'agendado':
        default:
            return '<span class="badge badge-warning"><span class="status-dot agendado"></span>Agendado</span>';
    }
}

// Máscaras de entrada em tempo real
function aplicarMascaraTelefone(input) {
    let v = input.value.replace(/\D/g, '');
    if (v.length > 11) v = v.slice(0, 11);
    if (v.length > 10) {
        v = v.replace(/^(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    } else if (v.length > 6) {
        v = v.replace(/^(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
    } else if (v.length > 2) {
        v = v.replace(/^(\d{2})(\d{0,5})/, '($1) $2');
    } else if (v.length > 0) {
        v = v.replace(/^(\d*)/, '($1');
    }
    input.value = v;
}

function aplicarMascaraCPF(input) {
    let v = input.value.replace(/\D/g, '');
    if (v.length > 11) v = v.slice(0, 11);
    if (v.length > 9) {
        v = v.replace(/^(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
    } else if (v.length > 6) {
        v = v.replace(/^(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
    } else if (v.length > 3) {
        v = v.replace(/^(\d{3})(\d{1,3})/, '$1.$2');
    }
    input.value = v;
}

// ========================================================
// Estatísticas Gerais (Cards do Topo)
// ========================================================
function carregarEstatisticasGerais() {
    const clientes = DB.get(STORAGE_KEYS.CLIENTS);
    const pets = DB.get(STORAGE_KEYS.PETS);

    const totalClientes = clientes.length;
    const totalPets = pets.length;
    const mediaPets = totalClientes > 0 ? (totalPets / totalClientes).toFixed(1).replace('.', ',') : '0';

    // Contar clientes cadastrados no mês atual
    const hoje = new Date();
    const anoAtual = hoje.getFullYear();
    const mesAtual = hoje.getMonth();
    const novosMes = clientes.filter(c => {
        if (!c.dataCadastro) return false;
        const d = new Date(c.dataCadastro + (c.dataCadastro.includes('T') ? '' : 'T00:00:00'));
        return d.getFullYear() === anoAtual && d.getMonth() === mesAtual;
    }).length;

    // Atualizar no DOM
    const elTotalCli = document.getElementById('stat-total-clientes');
    const elTotalPet = document.getElementById('stat-total-pets');
    const elMediaPet = document.getElementById('stat-media-pets');
    const elNovosMes = document.getElementById('stat-novos-mes');

    if (elTotalCli) elTotalCli.textContent = totalClientes;
    if (elTotalPet) elTotalPet.textContent = totalPets;
    if (elMediaPet) elMediaPet.textContent = mediaPets;
    if (elNovosMes) elNovosMes.textContent = novosMes;
}

// ========================================================
// Listagem, Busca, Filtros e Ordenação
// ========================================================
function carregarClientes() {
    const clientes = DB.get(STORAGE_KEYS.CLIENTS);
    const pets = DB.get(STORAGE_KEYS.PETS);

    // Mapear cada cliente com seus respectivos pets e quantidade
    const listaCompleta = clientes.map(cliente => {
        const petsDoCliente = pets.filter(p => p.clienteId === cliente.id);
        return {
            ...cliente,
            pets: petsDoCliente,
            petsCount: petsDoCliente.length
        };
    });

    // 1. Filtragem por busca (nome do cliente, nome de algum pet, telefone, email, CPF)
    let filtrados = listaCompleta.filter(cliente => {
        if (!termoBusca) return true;

        const nomeMatch = (cliente.nome || '').toLowerCase().includes(termoBusca);
        const emailMatch = (cliente.email || '').toLowerCase().includes(termoBusca);
        const telMatch = (cliente.telefone || '').replace(/\D/g, '').includes(termoBusca.replace(/\D/g, '')) ||
                         (cliente.telefone || '').toLowerCase().includes(termoBusca);
        const cpfMatch = (cliente.cpf || '').replace(/\D/g, '').includes(termoBusca.replace(/\D/g, ''));
        
        // Busca dinâmica nos nomes dos pets do tutor
        const petMatch = cliente.pets.some(p => (p.nome || '').toLowerCase().includes(termoBusca));

        return nomeMatch || emailMatch || telMatch || cpfMatch || petMatch;
    });

    // 2. Filtro por quantidade de pets
    if (filtroPets === 'com-pets') {
        filtrados = filtrados.filter(c => c.petsCount > 0);
    } else if (filtroPets === 'sem-pets') {
        filtrados = filtrados.filter(c => c.petsCount === 0);
    }

    // 3. Filtro por espécie de pet
    if (filtroEspecie) {
        filtrados = filtrados.filter(c => c.pets.some(p => (p.especie || '').toLowerCase() === filtroEspecie.toLowerCase()));
    }

    // 4. Ordenação
    filtrados.sort((a, b) => {
        let fator = direcaoOrdenacao === 'asc' ? 1 : -1;

        if (colunaOrdenacao === 'nome') {
            return fator * (a.nome || '').localeCompare(b.nome || '', 'pt-BR');
        } else if (colunaOrdenacao === 'telefone') {
            return fator * (a.telefone || '').localeCompare(b.telefone || '', 'pt-BR');
        } else if (colunaOrdenacao === 'petsCount') {
            return fator * (a.petsCount - b.petsCount);
        } else if (colunaOrdenacao === 'dataCadastro') {
            const dataA = new Date(a.dataCadastro || 0).getTime();
            const dataB = new Date(b.dataCadastro || 0).getTime();
            return fator * (dataA - dataB);
        }
        return 0;
    });

    // Atualizar indicadores visuais das colunas ordenadas
    atualizarIndicadoresOrdenacao();

    // 5. Paginação
    const paginacao = paginate(filtrados, paginaAtual, itensPorPagina);
    paginaAtual = paginacao.currentPage;

    // Atualizar contador de resultados
    const elContagem = document.getElementById('contagem-resultados');
    if (elContagem) {
        elContagem.textContent = `Exibindo ${paginacao.data.length} de ${filtrados.length} tutores encontrados`;
    }

    // Renderizar tabela e estado vazio
    const tbody = document.getElementById('lista-clientes-body');
    const emptyState = document.getElementById('empty-state');
    const emptyText = document.getElementById('empty-state-text');
    const tableFooter = document.getElementById('tabela-footer');

    if (filtrados.length === 0) {
        tbody.innerHTML = '';
        emptyState.style.display = 'block';
        if (termoBusca || filtroPets || filtroEspecie) {
            emptyText.textContent = 'Nenhum cliente atende aos filtros aplicados.';
        } else {
            emptyText.textContent = 'Nenhum cliente cadastrado ainda.';
        }
        tableFooter.style.display = 'none';
        return;
    }

    emptyState.style.display = 'none';
    tableFooter.style.display = 'flex';

    // Gerar linhas da tabela
    tbody.innerHTML = paginacao.data.map(cliente => {
        const iniciais = (cliente.nome || 'C').trim().charAt(0).toUpperCase();
        
        // Tags visuais dos pets
        const petBadges = cliente.pets.map(p => {
            const icone = getIconeEspecie(p.especie);
            const classeEsp = (p.especie || '').toLowerCase() === 'cão' ? 'dog' : (p.especie || '').toLowerCase() === 'gato' ? 'cat' : '';
            return `<span class="pet-mini-badge ${classeEsp}" title="${escapeHTML(p.raca || p.especie)}">${icone} ${escapeHTML(p.nome)}</span>`;
        }).join('');

        const petBadgeCount = cliente.petsCount > 0
            ? `<span class="badge badge-info" style="font-weight: 600;">${cliente.petsCount} ${cliente.petsCount === 1 ? 'pet' : 'pets'}</span>`
            : `<span class="badge badge-neutral">Sem pets</span>`;

        return `
            <tr>
                <td>
                    <div class="client-avatar-cell">
                        <div class="avatar-circle">${iniciais}</div>
                        <div>
                            <span class="client-name-link" onclick="visualizarPerfilCliente('${cliente.id}')" title="Ver ficha completa de ${escapeHTML(cliente.nome)}">
                                ${escapeHTML(cliente.nome)}
                            </span>
                            ${cliente.email ? `<div style="font-size: 0.8rem; color: var(--text-light);">${escapeHTML(cliente.email)}</div>` : ''}
                        </div>
                    </div>
                </td>
                <td>
                    <div style="font-weight: 500;">${cliente.telefone ? escapeHTML(formatPhone(cliente.telefone)) : '-'}</div>
                </td>
                <td>
                    <div>${petBadgeCount}</div>
                    ${petBadges ? `<div class="pets-tag-list" style="margin-top: 0.35rem;">${petBadges}</div>` : ''}
                </td>
                <td>
                    <span>${formatDate(cliente.dataCadastro)}</span>
                </td>
                <td style="text-align: right;">
                    <div class="table-actions" style="justify-content: flex-end;">
                        <button class="btn-icon" onclick="visualizarPerfilCliente('${cliente.id}')" title="Visualizar ficha e histórico">
                            <i data-lucide="eye"></i>
                        </button>
                        <button class="btn-icon" onclick="abrirModalCliente('${cliente.id}')" title="Editar cliente">
                            <i data-lucide="pencil"></i>
                        </button>
                        <button class="btn-icon text-danger" onclick="excluirCliente('${cliente.id}')" title="Excluir cliente">
                            <i data-lucide="trash-2"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    // Atualizar paginação
    const elInfoPaginacao = document.getElementById('info-paginacao');
    if (elInfoPaginacao) {
        const inicio = (paginacao.currentPage - 1) * itensPorPagina + 1;
        const fim = Math.min(inicio + paginacao.data.length - 1, filtrados.length);
        elInfoPaginacao.textContent = `Exibindo ${inicio}-${fim} de ${filtrados.length} tutores`;
    }

    renderPagination('paginacao-container', paginacao.currentPage, paginacao.totalPages, 'mudarPagina');

    // Renderizar novos ícones do Lucide
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// Navegação entre páginas
window.mudarPagina = function(novaPagina) {
    paginaAtual = novaPagina;
    carregarClientes();
};

// Eventos de Filtro e Busca
function aoDigitarBusca(event) {
    termoBusca = event.target.value.toLowerCase().trim();
    paginaAtual = 1;
    carregarClientes();
}

function aoMudarFiltro() {
    filtroPets = document.getElementById('filtro-pets').value;
    filtroEspecie = document.getElementById('filtro-especie').value;
    paginaAtual = 1;
    carregarClientes();
}

function limparFiltros() {
    document.getElementById('filtro-busca').value = '';
    document.getElementById('filtro-pets').value = '';
    document.getElementById('filtro-especie').value = '';
    document.getElementById('filtro-ordenacao').value = 'nome-asc';
    
    const globalSearch = document.getElementById('global-search');
    if (globalSearch) globalSearch.value = '';

    termoBusca = '';
    filtroPets = '';
    filtroEspecie = '';
    colunaOrdenacao = 'nome';
    direcaoOrdenacao = 'asc';
    paginaAtual = 1;

    carregarClientes();
}

// Ordenação
function alternarOrdenacao(coluna) {
    if (colunaOrdenacao === coluna) {
        direcaoOrdenacao = direcaoOrdenacao === 'asc' ? 'desc' : 'asc';
    } else {
        colunaOrdenacao = coluna;
        direcaoOrdenacao = 'asc';
    }

    // Sincronizar select
    sincronizarSelectOrdenacao();
    carregarClientes();
}

function aoMudarOrdenacaoSelect(valor) {
    const mapa = {
        'nome-asc': ['nome', 'asc'],
        'nome-desc': ['nome', 'desc'],
        'data-desc': ['dataCadastro', 'desc'],
        'data-asc': ['dataCadastro', 'asc'],
        'pets-desc': ['petsCount', 'desc'],
        'pets-asc': ['petsCount', 'asc']
    };
    if (mapa[valor]) {
        [colunaOrdenacao, direcaoOrdenacao] = mapa[valor];
        carregarClientes();
    }
}

function sincronizarSelectOrdenacao() {
    const select = document.getElementById('filtro-ordenacao');
    if (!select) return;

    if (colunaOrdenacao === 'nome') {
        select.value = direcaoOrdenacao === 'asc' ? 'nome-asc' : 'nome-desc';
    } else if (colunaOrdenacao === 'dataCadastro') {
        select.value = direcaoOrdenacao === 'desc' ? 'data-desc' : 'data-asc';
    } else if (colunaOrdenacao === 'petsCount') {
        select.value = direcaoOrdenacao === 'desc' ? 'pets-desc' : 'pets-asc';
    }
}

function atualizarIndicadoresOrdenacao() {
    const colunas = ['nome', 'telefone', 'petsCount', 'dataCadastro'];
    colunas.forEach(col => {
        const el = document.getElementById(`sort-icon-${col}`);
        if (!el) return;
        if (colunaOrdenacao === col) {
            el.innerHTML = direcaoOrdenacao === 'asc'
                ? '<i data-lucide="arrow-up"></i>'
                : '<i data-lucide="arrow-down"></i>';
        } else {
            el.innerHTML = '';
        }
    });
}

// ========================================================
// CRUD DE CLIENTES
// ========================================================
function abrirModalCliente(clienteId = null) {
    const form = document.getElementById('form-cliente');
    if (form) form.reset();
    const idInput = document.getElementById('client-id');
    if (idInput) idInput.value = '';
    const erroNome = document.getElementById('erro-client-nome');
    if (erroNome) erroNome.style.display = 'none';

    const titleEl = document.getElementById('modal-client-title');

    if (clienteId) {
        if (titleEl) titleEl.textContent = 'Editar Cliente';
        const clientes = DB.get(STORAGE_KEYS.CLIENTS);
        const cliente = clientes.find(c => c.id === clienteId);
        if (cliente) {
            document.getElementById('client-id').value = cliente.id;
            document.getElementById('client-nome').value = cliente.nome || '';
            document.getElementById('client-telefone').value = cliente.telefone || '';
            document.getElementById('client-email').value = cliente.email || '';
            document.getElementById('client-cpf').value = cliente.cpf || '';
            document.getElementById('client-endereco').value = cliente.endereco || '';
            document.getElementById('client-observacoes').value = cliente.observacoes || '';
        }
    } else {
        titleEl.textContent = 'Novo Cliente';
    }

    openModal('modal-client');
}

function salvarCliente(event) {
    event.preventDefault();

    const id = document.getElementById('client-id').value;
    let nome = document.getElementById('client-nome').value.trim();
    const telefone = document.getElementById('client-telefone').value.trim();
    const email = document.getElementById('client-email').value.trim();
    const cpf = document.getElementById('client-cpf').value.trim();
    const endereco = document.getElementById('client-endereco').value.trim();
    const observacoes = document.getElementById('client-observacoes').value.trim();

    // Campos opcionais do Pet
    const petNome = document.getElementById('client-pet-nome')?.value.trim();
    const petEspecie = document.getElementById('client-pet-especie')?.value || 'Cão';
    const petRaca = document.getElementById('client-pet-raca')?.value.trim() || 'SRD';
    const petPorte = document.getElementById('client-pet-porte')?.value || 'M';

    // Se não preencheu nome, gera um nome padrão amigável
    if (!nome) {
        if (petNome) {
            nome = `Tutor(a) do(a) ${petNome}`;
        } else if (telefone) {
            nome = `Cliente (${telefone})`;
        } else {
            nome = `Cliente ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
        }
    }

    const clientes = DB.get(STORAGE_KEYS.CLIENTS);

    if (id) {
        // Atualizar cliente existente
        const index = clientes.findIndex(c => c.id === id);
        if (index !== -1) {
            clientes[index] = {
                ...clientes[index],
                nome,
                telefone,
                email,
                cpf,
                endereco,
                observacoes
            };
            DB.save(STORAGE_KEYS.CLIENTS, clientes);

            // Se digitou dados de um novo pet ao editar o cliente, já cadastra também
            if (petNome) {
                const pets = DB.get(STORAGE_KEYS.PETS) || [];
                pets.push({
                    id: DB.generateId(),
                    clienteId: id,
                    nome: petNome,
                    especie: petEspecie,
                    raca: petRaca,
                    porte: petPorte,
                    dataNascimento: '',
                    peso: null,
                    alergias: '',
                    observacoes: '',
                    foto: ''
                });
                DB.save(STORAGE_KEYS.PETS, pets);
            }

            logAudit('CLIENT_UPDATED', 'Clientes', `Atualização cadastral do cliente "${nome}" (${id})`);
            showToast('Dados do cliente atualizados com sucesso!', 'success');

            // Se o perfil deste cliente estiver aberto, atualizar a visualização
            if (clientePerfilAtual && clientePerfilAtual.id === id) {
                visualizarPerfilCliente(id);
            }
        }
    } else {
        // Criar novo cliente
        const novoId = DB.generateId();
        const novoCliente = {
            id: novoId,
            nome,
            telefone,
            email,
            cpf,
            endereco,
            observacoes,
            dataCadastro: new Date().toISOString().split('T')[0]
        };
        clientes.unshift(novoCliente);
        DB.save(STORAGE_KEYS.CLIENTS, clientes);

        // Se informou o pet, cadastra junto na hora!
        if (petNome) {
            const pets = DB.get(STORAGE_KEYS.PETS) || [];
            pets.push({
                id: DB.generateId(),
                clienteId: novoId,
                nome: petNome,
                especie: petEspecie,
                raca: petRaca,
                porte: petPorte,
                dataNascimento: '',
                peso: null,
                alergias: '',
                observacoes: '',
                foto: ''
            });
            DB.save(STORAGE_KEYS.PETS, pets);
            logAudit('CLIENT_CREATED', 'Clientes', `Cadastro de novo cliente "${nome}" e pet "${petNome}"`);
            showToast(`Cliente e o Pet "${petNome}" cadastrados juntos com sucesso! 🐾`, 'success');
        } else {
            logAudit('CLIENT_CREATED', 'Clientes', `Cadastro de novo cliente "${nome}"`);
            showToast('Cliente cadastrado com sucesso!', 'success');
        }
    }

    closeModal('modal-client');
    carregarEstatisticasGerais();
    carregarClientes();
}

async function excluirCliente(clienteId) {
    const clientes = DB.get(STORAGE_KEYS.CLIENTS);
    const cliente = clientes.find(c => c.id === clienteId);
    if (!cliente) return;

    const pets = DB.get(STORAGE_KEYS.PETS);
    const petsDoCliente = pets.filter(p => p.clienteId === clienteId);

    const msg = petsDoCliente.length > 0
        ? `Deseja realmente excluir o cliente "${cliente.nome}"? Ele possui ${petsDoCliente.length} pet(s) cadastrado(s) que também serão removidos.`
        : `Deseja realmente excluir o cliente "${cliente.nome}"?`;

    const confirmado = await confirmDialog(msg);
    if (!confirmado) return;

    // Remover cliente
    const novosClientes = clientes.filter(c => c.id !== clienteId);
    DB.save(STORAGE_KEYS.CLIENTS, novosClientes);

    // Remover pets do cliente
    if (petsDoCliente.length > 0) {
        const novosPets = pets.filter(p => p.clienteId !== clienteId);
        DB.save(STORAGE_KEYS.PETS, novosPets);
    }

    logAudit('CLIENT_DELETED', 'Clientes', `Exclusão do cliente "${cliente.nome}" e de seus pets.`);
    showToast(`Cliente "${cliente.nome}" e seus pets foram excluídos com sucesso.`, 'success');

    // Fechar modal do perfil caso esteja aberto para este cliente
    if (clientePerfilAtual && clientePerfilAtual.id === clienteId) {
        closeModal('modal-profile');
        clientePerfilAtual = null;
    }

    carregarEstatisticasGerais();
    carregarClientes();
}

// ========================================================
// PERFIL COMPLETO DO CLIENTE (MODAL 2)
// ========================================================
function visualizarPerfilCliente(clienteId) {
    const clientes = DB.get(STORAGE_KEYS.CLIENTS);
    const cliente = clientes.find(c => c.id === clienteId);
    if (!cliente) {
        showToast('Cliente não encontrado.', 'error');
        return;
    }

    clientePerfilAtual = cliente;

    // Preencher cabeçalho e dados gerais com mascaramento seguro
    document.getElementById('profile-nome').textContent = cliente.nome || 'Sem Nome';
    document.getElementById('profile-avatar').textContent = (cliente.nome || 'C').charAt(0).toUpperCase();
    document.getElementById('profile-telefone').textContent = cliente.telefone ? formatPhone(cliente.telefone) : 'Não informado';
    document.getElementById('profile-email').textContent = cliente.email || 'Não informado';
    document.getElementById('profile-data-cadastro').textContent = formatDate(cliente.dataCadastro);

    // Mascaramento de CPF (LGPD): Exibe completo para Admin/Gerente, mascarado para outros perfis
    const role = getCurrentUserRole();
    const podeVerCompleto = (role === 'admin' || role === 'gerente');
    const cpfFormatado = cliente.cpf ? (podeVerCompleto ? cliente.cpf : CryptoUtils.maskCpf(cliente.cpf)) : 'Não informado';
    document.getElementById('profile-cpf').textContent = cpfFormatado;

    document.getElementById('profile-endereco').textContent = cliente.endereco || 'Não informado';
    document.getElementById('profile-observacoes').textContent = cliente.observacoes || 'Nenhuma observação cadastrada.';

    // Carregar seções do perfil
    carregarPetsDoPerfil(cliente.id);
    carregarServicosDoPerfil(cliente.id);
    carregarComprasDoPerfil(cliente.id);
    atualizarEstatisticasPerfil(cliente.id);

    // Abrir na primeira aba (Pets)
    const btnAbaPets = document.querySelector('#modal-profile .tabs .tab-btn');
    trocarAbaPerfil('pets', btnAbaPets);

    openModal('modal-profile');
}

async function acionarAnonimizacaoPerfilLGPD() {
    if (!clientePerfilAtual) return;
    const ok = await anonimizarClienteLGPD(clientePerfilAtual.id);
    if (ok) {
        visualizarPerfilCliente(clientePerfilAtual.id);
        carregarClientes();
    }
}
window.acionarAnonimizacaoPerfilLGPD = acionarAnonimizacaoPerfilLGPD;

function editarClienteDoPerfil() {
    if (clientePerfilAtual) {
        abrirModalCliente(clientePerfilAtual.id);
    }
}

function trocarAbaPerfil(nomeAba, elementoBotao) {
    const abas = ['pets', 'servicos', 'compras'];
    abas.forEach(nome => {
        const pane = document.getElementById(`pane-perfil-${nome}`);
        if (pane) pane.classList.remove('active');
    });

    const paneAtivo = document.getElementById(`pane-perfil-${nomeAba}`);
    if (paneAtivo) paneAtivo.classList.add('active');

    const todosBotoes = document.querySelectorAll('#modal-profile .tabs .tab-btn');
    todosBotoes.forEach(btn => btn.classList.remove('active'));
    if (elementoBotao) elementoBotao.classList.add('active');

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function atualizarEstatisticasPerfil(clienteId) {
    const pets = DB.get(STORAGE_KEYS.PETS).filter(p => p.clienteId === clienteId);
    const appointments = DB.get(STORAGE_KEYS.APPOINTMENTS).filter(a => a.clienteId === clienteId);
    const sales = DB.get(STORAGE_KEYS.SALES).filter(s => s.clienteId === clienteId);

    // Total gasto em serviços concluídos
    const totalServicos = appointments
        .filter(a => a.status === 'concluido')
        .reduce((soma, a) => soma + (Number(a.valor) || 0), 0);

    // Total gasto em compras de produtos
    const totalCompras = sales.reduce((soma, s) => soma + (Number(s.total) || 0), 0);
    const totalGastoGeral = totalServicos + totalCompras;

    document.getElementById('profile-stat-pets').textContent = pets.length;
    document.getElementById('profile-stat-atendimentos').textContent = appointments.length;
    document.getElementById('profile-stat-total-gasto').textContent = formatCurrency(totalGastoGeral);

    // Contadores das abas
    document.getElementById('profile-tab-count-pets').textContent = pets.length;
    document.getElementById('profile-tab-count-servicos').textContent = appointments.length;
    document.getElementById('profile-tab-count-compras').textContent = sales.length;
}

// Aba Pets do Perfil
function carregarPetsDoPerfil(clienteId) {
    const todosPets = DB.get(STORAGE_KEYS.PETS);
    const petsDoCliente = todosPets.filter(p => p.clienteId === clienteId);

    const container = document.getElementById('profile-pets-list');
    const emptyState = document.getElementById('empty-state-pets');

    if (petsDoCliente.length === 0) {
        container.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';

    container.innerHTML = petsDoCliente.map(pet => {
        const iconePadrao = getIconeEspecie(pet.especie);
        const fotoHtml = pet.foto
            ? `<img src="${pet.foto}" alt="${escapeHTML(pet.nome)}">`
            : `<span class="fallback-icon">${iconePadrao}</span>`;

        const idadeFormatada = calcularIdadePet(pet.dataNascimento);
        const pesoFormatado = pet.peso ? `${pet.peso} kg` : 'Não informado';

        const alergiasHtml = pet.alergias
            ? `<div class="pet-allergies-alert">
                 <i data-lucide="alert-triangle"></i>
                 <div><strong>Alergias / Cuidados:</strong> ${escapeHTML(pet.alergias)}</div>
               </div>`
            : '';

        const obsHtml = pet.observacoes
            ? `<div class="pet-obs-text">"${escapeHTML(pet.observacoes)}"</div>`
            : '';

        return `
            <div class="pet-profile-card">
                <div class="pet-card-head">
                    <div class="pet-photo-frame">
                        ${fotoHtml}
                    </div>
                    <div class="pet-card-title">
                        <h4>${escapeHTML(pet.nome)}</h4>
                        <p>${escapeHTML(pet.especie || 'Pet')} • ${escapeHTML(pet.raca || 'Raça não informada')}</p>
                    </div>
                </div>

                <div class="pet-badges-row">
                    <span class="badge badge-info">Porte: ${pet.porte || 'M'}</span>
                    <span class="badge badge-neutral">${pet.especie || 'Pet'}</span>
                </div>

                <div class="pet-specs-grid">
                    <div class="pet-spec-cell">
                        <label>Idade Estimada</label>
                        <span>${idadeFormatada}</span>
                    </div>
                    <div class="pet-spec-cell">
                        <label>Peso</label>
                        <span>${pesoFormatado}</span>
                    </div>
                </div>

                ${alergiasHtml}
                ${obsHtml}

                <div class="pet-card-bottom">
                    <button class="btn btn-secondary btn-sm" onclick="abrirModalPet('${clienteId}', '${pet.id}')">
                        <i data-lucide="edit-2"></i> Editar
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="excluirPet('${pet.id}')">
                        <i data-lucide="trash-2"></i> Excluir
                    </button>
                </div>
            </div>
        `;
    }).join('');

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// Aba Serviços do Perfil
function carregarServicosDoPerfil(clienteId) {
    const todosAgendamentos = DB.get(STORAGE_KEYS.APPOINTMENTS);
    const todosFuncionarios = DB.get(STORAGE_KEYS.EMPLOYEES);
    const todosPets = DB.get(STORAGE_KEYS.PETS);

    const agendamentos = todosAgendamentos
        .filter(a => a.clienteId === clienteId)
        .sort((a, b) => new Date(b.data + 'T' + (b.horario || '00:00')) - new Date(a.data + 'T' + (a.horario || '00:00')));

    const tbody = document.getElementById('profile-servicos-list');
    const emptyState = document.getElementById('empty-state-servicos');

    if (agendamentos.length === 0) {
        tbody.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';

    tbody.innerHTML = agendamentos.map(agd => {
        const pet = todosPets.find(p => p.id === agd.petId);
        const funcionario = todosFuncionarios.find(f => f.id === agd.funcionarioId);
        const nomePet = pet ? pet.nome : 'Pet não vinculado';
        const nomeFuncionario = funcionario ? funcionario.nome : 'Não informado';
        const badgeStatus = getBadgeStatusAgendamento(agd.status);

        return `
            <tr>
                <td>
                    <strong>${formatDate(agd.data)}</strong>
                    <div style="font-size: 0.8rem; color: var(--text-light);">${agd.horario || '--:--'}</div>
                </td>
                <td>
                    <strong>${escapeHTML(nomePet)}</strong>
                </td>
                <td>${escapeHTML(agd.servico || 'Serviço Geral')}</td>
                <td>${escapeHTML(nomeFuncionario)}</td>
                <td><strong>${formatCurrency(agd.valor)}</strong></td>
                <td>${badgeStatus}</td>
            </tr>
        `;
    }).join('');
}

// Aba Compras do Perfil
function carregarComprasDoPerfil(clienteId) {
    const todasVendas = DB.get(STORAGE_KEYS.SALES);
    const vendas = todasVendas
        .filter(v => v.clienteId === clienteId)
        .sort((a, b) => new Date(b.data) - new Date(a.data));

    const tbody = document.getElementById('profile-compras-list');
    const emptyState = document.getElementById('empty-state-compras');

    if (vendas.length === 0) {
        tbody.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';

    tbody.innerHTML = vendas.map(venda => {
        const itensDesc = (venda.itens || [])
            .map(it => `${it.quantidade}x ${escapeHTML(it.nome)}`)
            .join(', ');

        return `
            <tr>
                <td><strong>${formatDate(venda.data)}</strong></td>
                <td>
                    <div style="max-width: 320px; font-size: 0.85rem;" title="${escapeHTML(itensDesc)}">
                        ${escapeHTML(itensDesc) || 'Produtos diversos'}
                    </div>
                </td>
                <td>
                    <span class="badge badge-neutral">${escapeHTML(venda.formaPagamento || 'Outro')}</span>
                </td>
                <td style="text-align: right;">
                    <strong style="color: var(--primary-dark); font-size: 0.95rem;">
                        ${formatCurrency(venda.total)}
                    </strong>
                </td>
            </tr>
        `;
    }).join('');
}

function adicionarPetParaClienteAtual() {
    if (clientePerfilAtual) {
        abrirModalPet(clientePerfilAtual.id);
    }
}

// ========================================================
// CRUD DE PETS (MODAL 3)
// ========================================================
function abrirModalPet(clienteId, petId = null) {
    const form = document.getElementById('form-pet');
    form.reset();
    document.getElementById('pet-id').value = '';
    document.getElementById('pet-cliente-id').value = clienteId;
    fotoPetAtual = '';
    atualizarPreviewFotoPet('');

    const titleEl = document.getElementById('modal-pet-title');

    if (petId) {
        titleEl.textContent = 'Editar Pet';
        const pets = DB.get(STORAGE_KEYS.PETS);
        const pet = pets.find(p => p.id === petId);
        if (pet) {
            document.getElementById('pet-id').value = pet.id;
            document.getElementById('pet-nome').value = pet.nome || '';
            document.getElementById('pet-especie').value = pet.especie || 'Cão';
            document.getElementById('pet-raca').value = pet.raca || '';
            document.getElementById('pet-porte').value = pet.porte || 'M';
            document.getElementById('pet-nascimento').value = pet.dataNascimento || '';
            document.getElementById('pet-peso').value = pet.peso || '';
            document.getElementById('pet-alergias').value = pet.alergias || '';
            document.getElementById('pet-observacoes').value = pet.observacoes || '';

            if (pet.foto) {
                fotoPetAtual = pet.foto;
                atualizarPreviewFotoPet(pet.foto);
            }
        }
    } else {
        titleEl.textContent = 'Novo Pet';
    }

    openModal('modal-pet');
}

function aoMudarEspeciePet(especie) {
    // Sugestão visual rápida ou ajuste conforme espécie
    const inputRaca = document.getElementById('pet-raca');
    if (!inputRaca.value) {
        if (especie === 'Cão') inputRaca.placeholder = 'Ex: Golden, Poodle, SRD (Vira-lata)';
        else if (especie === 'Gato') inputRaca.placeholder = 'Ex: Siamês, Persa, SRD';
        else inputRaca.placeholder = 'Ex: Calopsita, Coelho Anão, etc.';
    }
}

// Gerenciamento de Upload de Foto com FileReader (Base64)
function aoSelecionarFotoPet(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        showToast('Por favor, selecione um arquivo de imagem válido.', 'warning');
        return;
    }

    // Limite de segurança de 2MB para não estourar armazenamento local
    if (file.size > 2 * 1024 * 1024) {
        showToast('A imagem selecionada deve ter no máximo 2MB.', 'warning');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            try {
                const canvas = document.createElement('canvas');
                const maxDim = 320;
                let width = img.width;
                let height = img.height;
                if (width > height) {
                    if (width > maxDim) {
                        height *= maxDim / width;
                        width = maxDim;
                    }
                } else {
                    if (height > maxDim) {
                        width *= maxDim / height;
                        height = maxDim;
                    }
                }
                canvas.width = Math.round(width);
                canvas.height = Math.round(height);
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                fotoPetAtual = canvas.toDataURL('image/jpeg', 0.82);
                atualizarPreviewFotoPet(fotoPetAtual);
            } catch (err) {
                fotoPetAtual = e.target.result;
                atualizarPreviewFotoPet(fotoPetAtual);
            }
        };
        img.onerror = function() {
            fotoPetAtual = e.target.result;
            atualizarPreviewFotoPet(fotoPetAtual);
        };
        img.src = e.target.result;
    };
    reader.onerror = function() {
        showToast('Erro ao carregar o arquivo de foto.', 'error');
    };
    reader.readAsDataURL(file);
}

function atualizarPreviewFotoPet(base64) {
    const preview = document.getElementById('pet-foto-preview');
    const placeholder = document.getElementById('pet-foto-placeholder');
    const btnRemover = document.getElementById('btn-remover-foto-pet');

    if (base64) {
        preview.src = base64;
        preview.style.display = 'block';
        placeholder.style.display = 'none';
        btnRemover.style.display = 'inline-flex';
    } else {
        preview.src = '';
        preview.style.display = 'none';
        placeholder.style.display = 'flex';
        btnRemover.style.display = 'none';
        const fileInput = document.getElementById('pet-foto-input');
        if (fileInput) fileInput.value = '';
    }

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function removerFotoPet() {
    fotoPetAtual = '';
    atualizarPreviewFotoPet('');
}

function salvarPet(event) {
    event.preventDefault();

    const id = document.getElementById('pet-id').value;
    const clienteId = document.getElementById('pet-cliente-id').value;
    const nome = document.getElementById('pet-nome').value.trim();
    const especie = document.getElementById('pet-especie').value;
    const raca = document.getElementById('pet-raca').value.trim();
    const porte = document.getElementById('pet-porte').value;
    const dataNascimento = document.getElementById('pet-nascimento').value;
    const pesoVal = document.getElementById('pet-peso').value;
    const peso = pesoVal ? parseFloat(pesoVal) : null;
    const alergias = document.getElementById('pet-alergias').value.trim();
    const observacoes = document.getElementById('pet-observacoes').value.trim();

    if (!nome) {
        showToast('O nome do pet é obrigatório.', 'warning');
        document.getElementById('pet-nome').focus();
        return;
    }

    if (!clienteId) {
        showToast('Nenhum tutor selecionado para vincular o pet.', 'error');
        return;
    }

    const pets = DB.get(STORAGE_KEYS.PETS);

    if (id) {
        // Atualizar pet existente
        const index = pets.findIndex(p => p.id === id);
        if (index !== -1) {
            pets[index] = {
                ...pets[index],
                nome,
                especie,
                raca,
                porte,
                dataNascimento,
                peso,
                alergias,
                observacoes,
                foto: fotoPetAtual
            };
            DB.save(STORAGE_KEYS.PETS, pets);
            showToast(`Pet "${nome}" atualizado com sucesso!`, 'success');
        }
    } else {
        // Criar novo pet
        const novoPet = {
            id: DB.generateId(),
            clienteId,
            nome,
            especie,
            raca,
            porte,
            dataNascimento,
            peso,
            alergias,
            observacoes,
            foto: fotoPetAtual
        };
        pets.unshift(novoPet);
        DB.save(STORAGE_KEYS.PETS, pets);
        showToast(`Pet "${nome}" cadastrado com sucesso!`, 'success');
    }

    closeModal('modal-pet');

    // Atualizar visualização do perfil se estiver aberto
    if (clientePerfilAtual && clientePerfilAtual.id === clienteId) {
        carregarPetsDoPerfil(clienteId);
        atualizarEstatisticasPerfil(clienteId);
    }

    carregarEstatisticasGerais();
    carregarClientes();
}

async function excluirPet(petId) {
    const pets = DB.get(STORAGE_KEYS.PETS);
    const pet = pets.find(p => p.id === petId);
    if (!pet) return;

    const confirmado = await confirmDialog(`Deseja realmente excluir o pet "${pet.nome}"? Esta ação não pode ser desfeita.`);
    if (!confirmado) return;

    const novosPets = pets.filter(p => p.id !== petId);
    DB.save(STORAGE_KEYS.PETS, novosPets);

    showToast(`Pet "${pet.nome}" excluído com sucesso.`, 'success');

    // Atualizar perfil se aberto
    if (clientePerfilAtual) {
        carregarPetsDoPerfil(clientePerfilAtual.id);
        atualizarEstatisticasPerfil(clientePerfilAtual.id);
    }

    carregarEstatisticasGerais();
    carregarClientes();
}
