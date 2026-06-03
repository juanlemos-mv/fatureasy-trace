(function () {
    const STORAGE_KEY = 'fatureasy.trace.dashboard';
    const MANAGER_MODE_KEY = 'fatureasy.trace.managerMode';
    const WITHOUT_OWNER = 'Sem responsavel';

    const importForm = document.getElementById('importForm');
    const jsonFile = document.getElementById('jsonFile');
    const clearData = document.getElementById('clearData');
    const importMessage = document.getElementById('importMessage');
    const sourceInfo = document.getElementById('sourceInfo');
    const emptyState = document.getElementById('emptyState');
    const dashboardContent = document.getElementById('dashboardContent');
    const managerViewToggle = document.getElementById('managerViewToggle');
    const managerView = document.getElementById('managerView');
    const operationalView = document.getElementById('operationalView');
    const activeFilterPanel = document.getElementById('activeFilterPanel');
    const activeFilterTitle = document.getElementById('activeFilterTitle');
    const activeFilterChips = document.getElementById('activeFilterChips');
    const sharedIndicator = document.getElementById('sharedIndicator');
    const archivedIndicator = document.getElementById('archivedIndicator');
    const clearScope = document.getElementById('clearScope');
    const managerClearScope = document.getElementById('managerClearScope');
    const managerScope = document.getElementById('managerScope');
    const managerDeliveryPercent = document.getElementById('managerDeliveryPercent');
    const managerDone = document.getElementById('managerDone');
    const managerDoneNote = document.getElementById('managerDoneNote');
    const managerPending = document.getElementById('managerPending');
    const managerDoing = document.getElementById('managerDoing');
    const managerReview = document.getElementById('managerReview');
    const managerWithoutOwner = document.getElementById('managerWithoutOwner');
    const managerBacklog = document.getElementById('managerBacklog');
    const managerPeopleBody = document.getElementById('managerPeopleBody');
    const managerActionList = document.getElementById('managerActionList');
    const managerFrontBody = document.getElementById('managerFrontBody');
    const searchInput = document.getElementById('cardSearch');
    const personFilter = document.getElementById('personFilter');
    const listFilter = document.getElementById('listFilter');
    const frontFilter = document.getElementById('frontFilter');
    const conditionFilter = document.getElementById('conditionFilter');
    const withoutOwnerFilter = document.getElementById('withoutOwnerFilter');
    const includeArchivedFilter = document.getElementById('includeArchivedFilter');
    const clearFilters = document.getElementById('clearFilters');
    const exportCsv = document.getElementById('exportCsv');
    const visibleCards = document.getElementById('visibleCards');
    const workflowGrid = document.getElementById('workflowGrid');
    const deliveryGauge = document.getElementById('deliveryGauge');
    const stageChart = document.getElementById('stageChart');
    const peopleChart = document.getElementById('peopleChart');
    const typeChart = document.getElementById('typeChart');
    const personWorkloadBody = document.getElementById('personWorkloadBody');
    const typeCountBody = document.getElementById('typeCountBody');
    const cardRowsBody = document.getElementById('cardRowsBody');
    const actionList = document.getElementById('actionList');
    const summaryCards = Array.from(document.querySelectorAll('[data-summary]'));

    let dashboard = emptyDashboard();
    let managerMode = localStorage.getItem(MANAGER_MODE_KEY) === 'true';

    importForm.addEventListener('submit', event => {
        event.preventDefault();

        const file = jsonFile.files[0];
        if (!file) {
            showMessage('Selecione um arquivo JSON do Trello.', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = () => importJson(file.name, reader.result);
        reader.onerror = () => showMessage('Nao foi possivel ler o arquivo informado.', 'error');
        reader.readAsText(file, 'UTF-8');
    });

    clearData.addEventListener('click', () => {
        localStorage.removeItem(STORAGE_KEY);
        dashboard = emptyDashboard();
        jsonFile.value = '';
        resetFilters();
        renderDashboard();
        showMessage('Dados locais removidos.', 'success');
    });

    [searchInput, personFilter, listFilter, frontFilter, conditionFilter, withoutOwnerFilter].forEach(input => {
        input.addEventListener('input', applyFilters);
        input.addEventListener('change', applyFilters);
    });

    includeArchivedFilter.addEventListener('change', () => {
        populateFilters();
        renderQuickActions();
        applyFilters();
    });

    clearFilters.addEventListener('click', () => {
        resetFilters();
        populateFilters();
        renderQuickActions();
        applyFilters();
    });

    clearScope.addEventListener('click', () => {
        resetFilters();
        populateFilters();
        renderQuickActions();
        applyFilters();
    });

    managerClearScope.addEventListener('click', () => {
        resetFilters();
        populateFilters();
        renderQuickActions();
        applyFilters();
    });

    exportCsv.addEventListener('click', exportFilteredCsv);

    managerViewToggle.addEventListener('click', () => {
        setManagerMode(!managerMode);
        applyFilters();
    });

    document.addEventListener('click', event => {
        const personTrigger = event.target.closest('[data-person-filter]');

        if (!personTrigger) {
            return;
        }

        applyPersonFilter(personTrigger.dataset.personFilter);
    });

    actionList.addEventListener('click', event => {
        const action = event.target.closest('[data-action]');

        if (!action) {
            return;
        }

        applyQuickAction(action.dataset.action);
    });

    loadStoredDashboard();

    function importJson(sourceFile, content) {
        try {
            const data = JSON.parse(content);
            dashboard = buildDashboard(data, sourceFile);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(dashboard));
            resetFilters();
            renderDashboard();
            showMessage('JSON importado com sucesso.', 'success');
        } catch (error) {
            showMessage('Nao foi possivel importar o JSON informado.', 'error');
        }
    }

    function loadStoredDashboard() {
        const stored = localStorage.getItem(STORAGE_KEY);

        if (!stored) {
            renderDashboard();
            return;
        }

        try {
            dashboard = JSON.parse(stored);
            dashboard = normalizeStoredDashboard(dashboard);
        } catch (error) {
            localStorage.removeItem(STORAGE_KEY);
            dashboard = emptyDashboard();
        }

        renderDashboard();
    }

    function normalizeStoredDashboard(stored) {
        const cards = Array.isArray(stored.cards) ? stored.cards : [];

        return {
            ...emptyDashboard(),
            ...stored,
            cards: cards.map(card => ({
                ...card,
                status: cardStatus(card.listName),
                front: cardFront(card.name, card.labels || [], card.listName),
                condition: cardCondition(card.labels || []),
                type: cardCondition(card.labels || [])
            }))
        };
    }

    function buildDashboard(data, sourceFile) {
        if (!Array.isArray(data.cards)) {
            throw new Error('Invalid Trello JSON');
        }

        const lists = readLists(data.lists || []);
        const members = readMembers(data.members || []);
        const cards = data.cards
            .filter(card => !card.closed)
            .map(card => normalizeCard(card, lists, members));

        return {
            imported: true,
            sourceFile: sourceFile || 'Arquivo importado',
            importedAt: new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }),
            cards: cards,
            listOrder: listOrder(cards, lists)
        };
    }

    function readLists(lists) {
        const result = new Map();

        lists.forEach(list => {
            result.set(list.id, {
                name: list.name || 'Lista sem nome',
                position: Number(list.pos || 999999),
                closed: Boolean(list.closed)
            });
        });

        return result;
    }

    function readMembers(members) {
        const result = new Map();

        members.forEach(member => {
            result.set(member.id, member.fullName || member.username || 'Membro sem nome');
        });

        return result;
    }

    function normalizeCard(card, lists, members) {
        const labels = Array.isArray(card.labels)
            ? card.labels.map(label => label.name).filter(Boolean)
            : [];
        const owners = Array.isArray(card.idMembers) && card.idMembers.length
            ? card.idMembers.map(id => members.get(id) || id).filter(Boolean)
            : [WITHOUT_OWNER];
        const list = lists.get(card.idList) || { name: 'Lista nao encontrada', closed: false };
        const name = card.name || 'Card sem titulo';
        const lastActivity = formatDate(card.dateLastActivity);
        const resolvedOwners = owners.length ? owners : [WITHOUT_OWNER];
        const front = cardFront(name, labels, list.name);
        const status = cardStatus(list.name);
        const condition = cardCondition(labels);

        return {
            name: name,
            url: card.shortUrl || card.url || '',
            listName: list.name,
            listClosed: list.closed,
            status: status,
            front: front,
            condition: condition,
            owners: resolvedOwners,
            labels: labels,
            type: condition,
            lastActivity: lastActivity,
            lastActivityRaw: card.dateLastActivity || '',
            withoutOwner: resolvedOwners.length === 1 && resolvedOwners[0] === WITHOUT_OWNER,
            search: normalize([name, resolvedOwners.join(' '), front, condition, status.label, list.name, labels.join(' '), list.closed ? 'arquivado historico' : '', lastActivity].join(' '))
        };
    }

    function cardFront(name, labels, listName) {
        const normalizedList = normalize(listName);

        if (normalizedList === '[rhp]') {
            return 'RHP';
        }

        if (normalizedList.includes('sus gateway')) {
            return 'SusBoot';
        }

        const text = normalize([name, labels.join(' ')].join(' '));

        if (text.includes('[rhp]') || text.includes(' rhp')) {
            return 'RHP';
        }

        if (text.includes('[susboot]') || text.includes('susboot')) {
            return 'SusBoot';
        }

        return 'Sem frente';
    }

    function cardStatus(listName) {
        const group = listGroup(listName);
        const normalized = normalize(listName);

        if (normalized === '[rhp]') {
            return { group: 'todo', label: 'To Do' };
        }

        if (normalized.includes('sus gateway')) {
            return { group: 'backlog', label: 'Backlog' };
        }

        return { group: group, label: statusLabel(group, listName) };
    }

    function statusLabel(group, fallback) {
        if (group === 'backlog') {
            return 'Backlog';
        }

        if (group === 'todo') {
            return 'To Do';
        }

        if (group === 'doing') {
            return 'Doing';
        }

        if (group === 'review') {
            return 'Review';
        }

        if (group === 'done') {
            return 'Done';
        }

        return fallback || 'Outro status';
    }

    function cardCondition(labels) {
        return labels.some(label => normalize(label) === 'impediment')
            ? 'Feature impedida'
            : 'Feature';
    }

    function listOrder(cards, lists) {
        const names = Array.from(lists.values())
            .sort((left, right) => left.position - right.position)
            .map(list => list.name)
            .filter((name, index, all) => all.indexOf(name) === index)
            .filter(name => cards.some(card => card.listName === name));
        const missing = cards
            .map(card => card.listName)
            .filter((name, index, all) => all.indexOf(name) === index && !names.includes(name))
            .sort();

        return names.concat(missing);
    }

    function renderDashboard() {
        sourceInfo.textContent = dashboard.imported
            ? sourceInfoText()
            : 'Fonte atual: nenhum arquivo importado';
        emptyState.classList.toggle('hidden', dashboard.imported);
        dashboardContent.classList.toggle('hidden', !dashboard.imported);

        updateViewMode();
        populateFilters();
        renderQuickActions();
        renderRows();
        applyFilters();
    }

    function sourceInfoText() {
        const archived = archivedCardsCount();
        const suffix = archived > 0
            ? ` | ${archived} cards em listas arquivadas fora da visao padrao`
            : '';

        return `Fonte atual: ${dashboard.sourceFile} - ${dashboard.importedAt}${suffix}`;
    }

    function populateFilters() {
        const cards = visibleSourceCards();

        fillSelect(personFilter, 'Todas as pessoas', unique(cards.flatMap(card => card.owners)).sort());
        fillSelect(listFilter, 'Todos os status', statusFilterValues(cards));
        fillSelect(frontFilter, 'Todas as frentes', unique(cards.map(card => card.front || 'Sem frente')).sort(sortFilterTag));
        fillSelect(conditionFilter, 'Todas as features', ['Feature', 'Feature impedida']);
    }

    function fillSelect(select, label, values) {
        const selected = select.value;
        select.innerHTML = `<option value="">${label}</option>` + values
            .map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`)
            .join('');

        if (values.includes(selected)) {
            select.value = selected;
        }
    }

    function statusFilterValues(cards) {
        const order = ['Backlog', 'To Do', 'Doing', 'Review', 'Done'];
        const available = unique(cards.map(card => card.status.label));

        return order.filter(status => available.includes(status))
            .concat(available.filter(status => !order.includes(status)).sort());
    }

    function sortFilterTag(left, right) {
        const leftPrefix = left.startsWith('[') ? 0 : 1;
        const rightPrefix = right.startsWith('[') ? 0 : 1;

        return leftPrefix - rightPrefix || left.localeCompare(right);
    }

    function visibleSourceCards() {
        return dashboard.cards.filter(card => includeArchivedFilter.checked || !card.listClosed);
    }

    function sourceCardsNote() {
        return includeArchivedFilter.checked
            ? 'inclui listas arquivadas do JSON'
            : 'somente listas ativas do Trello';
    }

    function renderRows() {
        cardRowsBody.innerHTML = dashboard.cards.map(card => `
            <tr class="card-row"
                data-search="${escapeHtml(card.search)}"
                data-person="${escapeHtml(card.owners.join(', '))}"
                data-list="${escapeHtml(card.listName)}"
                data-list-closed="${card.listClosed}"
                data-status="${escapeHtml(card.status.label)}"
                data-status-group="${escapeHtml(card.status.group)}"
                data-front="${escapeHtml(card.front)}"
                data-condition="${escapeHtml(card.condition)}"
                data-type="${escapeHtml(card.condition)}"
                data-last-activity="${escapeHtml(card.lastActivity || 'Sem data')}"
                data-without-owner="${card.withoutOwner}">
                <td>${card.url ? `<a class="card-title" href="${escapeHtml(card.url)}" target="_blank">${escapeHtml(card.name)}</a>` : `<span class="card-title">${escapeHtml(card.name)}</span>`}</td>
                <td>${escapeHtml(card.listName)}${card.listClosed ? ' <span class="table-badge muted">Arquivada</span>' : ''}</td>
                <td>${escapeHtml(card.owners.join(', '))}</td>
                <td><span class="table-badge">${escapeHtml(card.front)}</span> <span class="table-badge ${card.condition === 'Feature impedida' ? 'warning-badge' : ''}">${escapeHtml(card.condition)}</span></td>
                <td>${escapeHtml(card.lastActivity || 'Sem data')}</td>
            </tr>
        `).join('');
    }

    function applyFilters() {
        const rows = Array.from(document.querySelectorAll('.card-row'));
        const search = normalize(searchInput.value);
        const person = personFilter.value;
        const status = listFilter.value;
        const front = frontFilter.value;
        const condition = conditionFilter.value;
        const onlyWithoutOwner = withoutOwnerFilter.checked;
        const includeArchived = includeArchivedFilter.checked;
        const filteredRows = [];

        rows.forEach(row => {
            const show = (!search || row.dataset.search.includes(search))
                && (!person || splitMembers(row.dataset.person).includes(person))
                && (!status || row.dataset.status === status)
                && (!front || row.dataset.front === front)
                && (!condition || row.dataset.condition === condition)
                && (includeArchived || row.dataset.listClosed !== 'true')
                && (!onlyWithoutOwner || row.dataset.withoutOwner === 'true');

            row.hidden = !show;

            if (show) {
                filteredRows.push(row);
            }
        });

        visibleCards.textContent = filteredRows.length;

        const withoutOwner = filteredRows.filter(row => row.dataset.withoutOwner === 'true').length;
        const doing = filteredRows.filter(row => row.dataset.statusGroup === 'doing').length;
        const done = filteredRows.filter(row => row.dataset.statusGroup === 'done').length;
        const sourceCards = visibleSourceCards();

        renderActiveFilters(filteredRows);
        updateSummary('Cards no quadro atual', sourceCards.length, dashboard.imported ? sourceCardsNote() : 'importe um JSON para iniciar', '');
        updateSummary('Resultado do filtro', filteredRows.length, dashboard.imported ? 'cards que batem com os filtros atuais' : 'sem dados importados', '');
        updateSummary('Sem responsavel', withoutOwner, dashboard.imported ? 'cards do recorte sem dono' : 'sem dados importados', withoutOwner > 0 ? 'danger' : 'neutral');
        updateSummary('Entregues', done, dashboard.imported ? 'cards do recorte na lista Done' : 'sem dados importados', dashboard.imported ? 'success' : 'neutral');
        updateSummary('Em andamento', doing, dashboard.imported ? 'cards do recorte na lista Doing' : 'sem dados importados', dashboard.imported ? 'warning' : 'neutral');

        renderWorkflow(filteredRows);
        renderCharts(filteredRows);
        renderPeople(filteredRows);
        renderTypes(filteredRows);
        renderManagerView(filteredRows);
    }

    function renderActiveFilters(filteredRows) {
        activeFilterPanel.classList.toggle('hidden', !dashboard.imported);

        if (!dashboard.imported) {
            activeFilterTitle.textContent = 'Quadro atual';
            activeFilterChips.innerHTML = '';
            return;
        }

        const filters = activeFilterItems();
        const shared = countShared(filteredRows);
        const archived = archivedCardsCount();

        activeFilterTitle.textContent = filters.length
            ? 'Filtros aplicados ao painel'
            : 'Quadro atual';
        activeFilterChips.innerHTML = filters.length
            ? filters.map(filter => `
                <span class="filter-chip">
                    <strong>${escapeHtml(filter.label)}</strong>
                    ${escapeHtml(filter.value)}
                </span>
            `).join('')
            : '<span class="filter-chip empty">Nenhum filtro ativo</span>';
        sharedIndicator.classList.toggle('active', shared > 0);
        sharedIndicator.innerHTML = `
            <span>Cards em conjunto</span>
            <strong>${shared}</strong>
            <small>no recorte atual</small>
        `;
        archivedIndicator.classList.toggle('active', archived > 0);
        archivedIndicator.innerHTML = `
            <span>Historico arquivado</span>
            <strong>${archived}</strong>
            <small>${includeArchivedFilter.checked ? 'incluido na visao' : 'fora da visao padrao'}</small>
        `;
    }

    function activeFilterItems() {
        const filters = [];

        if (searchInput.value.trim()) {
            filters.push({ label: 'Busca', value: searchInput.value.trim() });
        }

        if (personFilter.value) {
            filters.push({ label: 'Responsavel', value: personFilter.value });
        }

        if (listFilter.value) {
            filters.push({ label: 'Status', value: listFilter.value });
        }

        if (frontFilter.value) {
            filters.push({ label: 'Frente', value: frontFilter.value });
        }

        if (conditionFilter.value) {
            filters.push({ label: 'Condicao', value: conditionFilter.value });
        }

        if (withoutOwnerFilter.checked) {
            filters.push({ label: 'Filtro', value: 'Sem responsavel' });
        }

        if (includeArchivedFilter.checked) {
            filters.push({ label: 'Historico', value: 'Inclui listas arquivadas' });
        }

        return filters;
    }

    function renderQuickActions() {
        const cards = visibleSourceCards();

        if (!dashboard.imported || !cards.length) {
            actionList.innerHTML = '';
            return;
        }

        const actions = [
            {
                action: 'without-owner',
                label: 'Sem responsavel no quadro',
                total: cards.filter(card => card.withoutOwner).length,
                note: 'cards que precisam de dono'
            },
            {
                action: 'doing',
                label: 'Doing no quadro',
                total: cards.filter(card => card.status.group === 'doing').length,
                note: 'trabalho aberto agora'
            },
            {
                action: 'backlog',
                label: 'Backlog no quadro',
                total: cards.filter(card => card.status.group === 'backlog').length,
                note: 'entrada para priorizacao'
            },
            {
                action: 'rhp',
                label: 'RHP no quadro',
                total: cards.filter(card => card.front === 'RHP').length,
                note: 'cards dessa frente'
            },
            {
                action: 'susboot',
                label: 'SusBoot no quadro',
                total: cards.filter(card => card.front === 'SusBoot').length,
                note: 'cards dessa frente'
            },
            {
                action: 'impediment',
                label: 'Impedidas no quadro',
                total: cards.filter(card => card.condition === 'Feature impedida').length,
                note: 'features com impedimento'
            }
        ];

        actionList.innerHTML = actions.map(action => `
            <button class="quick-action" type="button" data-action="${escapeHtml(action.action)}">
                <span>${escapeHtml(action.label)}</span>
                <strong>${action.total}</strong>
                <small>${escapeHtml(action.note)}</small>
            </button>
        `).join('');
    }

    function renderWorkflow(filteredRows) {
        const counts = new Map();
        filteredRows.forEach(row => counts.set(row.dataset.status, (counts.get(row.dataset.status) || 0) + 1));

        const names = orderedStatusNames(counts);

        workflowGrid.innerHTML = names.map(name => `
            <article class="workflow-card ${severityForStatus(name)}" data-list="${escapeHtml(name)}">
                <span class="workflow-title">${escapeHtml(name)}</span>
                <strong>${counts.get(name)}</strong>
                <span>${workflowNote(statusGroupFromLabel(name))}</span>
            </article>
        `).join('');
    }

    function renderCharts(filteredRows) {
        renderDeliveryGauge(filteredRows);
        renderStageChart(filteredRows);
        renderPeopleChart(filteredRows);
        renderTypeChart(filteredRows);
    }

    function renderDeliveryGauge(filteredRows) {
        const total = filteredRows.length;
        const done = filteredRows.filter(row => row.dataset.statusGroup === 'done').length;
        const percent = total ? Math.round((done / total) * 100) : 0;

        deliveryGauge.innerHTML = `
            <div class="gauge-ring" style="background: conic-gradient(var(--trace-success) 0 ${percent}%, var(--trace-surface-raised) ${percent}% 100%)">
                <div class="gauge-center">
                    <strong>${percent}%</strong>
                    <span>${done} de ${total}</span>
                </div>
            </div>
            <div class="gauge-caption">
                <strong>${done}</strong>
                <span>cards entregues no recorte atual</span>
            </div>
        `;
    }

    function renderStageChart(filteredRows) {
        const counts = new Map();

        filteredRows.forEach(row => {
            counts.set(row.dataset.status, (counts.get(row.dataset.status) || 0) + 1);
        });

        const statuses = orderedStatusNames(counts);
        const max = Math.max(...statuses.map(name => counts.get(name)), 1);

        stageChart.innerHTML = statuses.length
            ? statuses.map(name => chartBar(name, counts.get(name), max, chartColorForStatus(name))).join('')
            : emptyChart('Nenhum status no filtro.');
    }

    function orderedStatusNames(counts) {
        const order = ['Backlog', 'To Do', 'Doing', 'Review', 'Done'];
        const ordered = order.filter(name => counts.has(name));
        const missing = Array.from(counts.keys())
            .filter(name => !ordered.includes(name))
            .sort();

        return ordered.concat(missing);
    }

    function chartColorForStatus(status) {
        const group = statusGroupFromLabel(status);

        if (group === 'done') {
            return 'success';
        }

        if (group === 'doing') {
            return 'warning';
        }

        if (group === 'review') {
            return 'danger';
        }

        if (group === 'todo') {
            return 'secondary';
        }

        return 'primary';
    }

    function renderPeopleChart(filteredRows) {
        const people = new Map();

        filteredRows.forEach(row => {
            splitMembers(row.dataset.person).forEach(member => {
                people.set(member, (people.get(member) || 0) + 1);
            });
        });

        const rows = Array.from(people.entries())
            .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
            .slice(0, 8);
        const max = Math.max(...rows.map(row => row[1]), 1);

        peopleChart.innerHTML = rows.length
            ? rows.map(([name, total]) => personChartBar(name, total, max)).join('')
            : emptyChart('Nenhum responsavel no filtro.');
    }

    function renderTypeChart(filteredRows) {
        const types = new Map();

        filteredRows.forEach(row => {
            types.set(row.dataset.type, (types.get(row.dataset.type) || 0) + 1);
        });

        const rows = Array.from(types.entries())
            .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
            .slice(0, 5);
        const total = rows.reduce((sum, row) => sum + row[1], 0);
        const colors = ['var(--trace-secondary)', 'var(--trace-success)', 'var(--trace-warning)', 'var(--trace-danger)', 'var(--trace-sidebar-text)'];
        let cursor = 0;
        const gradient = rows.map((row, index) => {
            const start = cursor;
            const size = total ? (row[1] / total) * 100 : 0;
            cursor += size;
            return `${colors[index]} ${start}% ${cursor}%`;
        }).join(', ');

        typeChart.innerHTML = rows.length
            ? `
                <div class="type-donut" style="background: conic-gradient(${gradient})">
                    <div class="type-donut-center">
                        <strong>${total}</strong>
                        <span>cards</span>
                    </div>
                </div>
                <div class="type-legend">
                    ${rows.map(([type, count], index) => `
                        <div class="legend-row">
                            <span class="legend-color" style="background: ${colors[index]}"></span>
                            <span>${escapeHtml(type)}</span>
                            <strong>${count}</strong>
                        </div>
                    `).join('')}
                </div>
            `
            : emptyChart('Nenhum tipo no filtro.');
    }

    function chartBar(label, total, max, color) {
        const width = Math.max(Math.round((total / max) * 100), total > 0 ? 4 : 0);

        return `
            <div class="chart-row">
                <div class="chart-row-label">
                    <span>${escapeHtml(label)}</span>
                    <strong>${total}</strong>
                </div>
                <div class="chart-track">
                    <span class="chart-fill ${color}" style="width: ${width}%"></span>
                </div>
            </div>
        `;
    }

    function personChartBar(name, total, max) {
        const width = Math.max(Math.round((total / max) * 100), total > 0 ? 4 : 0);

        return `
            <button class="chart-row person-chart-row" type="button" data-person-filter="${escapeHtml(name)}">
                <div class="chart-row-label">
                    <span>${escapeHtml(name)}</span>
                    <strong>${total}</strong>
                </div>
                <div class="chart-track">
                    <span class="chart-fill secondary" style="width: ${width}%"></span>
                </div>
            </button>
        `;
    }

    function emptyChart(message) {
        return `<div class="chart-empty">${message}</div>`;
    }

    function renderPeople(filteredRows) {
        const people = new Map();

        filteredRows.forEach(row => {
            splitMembers(row.dataset.person).forEach(member => {
                if (!people.has(member)) {
                    people.set(member, { total: 0, backlog: 0, todo: 0, doing: 0, review: 0, done: 0, other: 0, types: new Map() });
                }

                const person = people.get(member);
                const group = row.dataset.statusGroup;
                person.total++;
                person.types.set(row.dataset.type, (person.types.get(row.dataset.type) || 0) + 1);

                person[group === 'other' ? 'other' : group]++;
            });
        });

        personWorkloadBody.innerHTML = Array.from(people.entries())
            .sort((left, right) => right[1].total - left[1].total || left[0].localeCompare(right[0]))
            .map(([name, person]) => `
                <tr>
                    <td><button class="person-filter-button" type="button" data-person-filter="${escapeHtml(name)}">${escapeHtml(name)}</button></td>
                    <td>${person.total}</td>
                    <td>${person.backlog}</td>
                    <td>${person.todo}</td>
                    <td>${person.doing}</td>
                    <td>${person.review}</td>
                    <td>${person.done}</td>
                    <td>${person.other}</td>
                    <td>${escapeHtml(mainType(person.types))}</td>
                </tr>
            `)
            .join('') || '<tr><td colspan="9">Nenhum card encontrado para o filtro.</td></tr>';
    }

    function renderTypes(filteredRows) {
        const types = new Map();
        filteredRows.forEach(row => types.set(row.dataset.type, (types.get(row.dataset.type) || 0) + 1));

        typeCountBody.innerHTML = Array.from(types.entries())
            .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
            .map(([type, total]) => `
                <tr>
                    <td>${escapeHtml(type)}</td>
                    <td>${total}</td>
                    <td>${type === 'Feature impedida' ? 'tem etiqueta Impediment' : 'sem impedimento'}</td>
                </tr>
            `)
            .join('') || '<tr><td colspan="3">Nenhum tipo encontrado para o filtro.</td></tr>';
    }

    function renderManagerView(filteredRows) {
        const total = filteredRows.length;
        const done = countByGroup(filteredRows, 'done');
        const doing = countByGroup(filteredRows, 'doing');
        const review = countByGroup(filteredRows, 'review');
        const backlog = countByGroup(filteredRows, 'backlog');
        const other = countByGroup(filteredRows, 'other');
        const withoutOwner = filteredRows.filter(row => row.dataset.withoutOwner === 'true').length;
        const shared = countShared(filteredRows);
        const selectedPerson = selectedManagerPerson();
        const pending = total - done;
        const percent = deliveryPercent(done, total);

        managerScope.textContent = managerScopeText(total, shared);
        managerDeliveryPercent.textContent = `${percent}%`;
        managerDone.textContent = done;
        managerDoneNote.textContent = selectedPerson
            ? `${done} de ${total} cards em Done para a pessoa filtrada`
            : `${done} de ${total} cards em Done`;
        managerPending.textContent = pending;
        managerDoing.textContent = doing;
        managerReview.textContent = review;
        managerWithoutOwner.textContent = withoutOwner;
        managerBacklog.textContent = backlog;

        renderManagerPeople(filteredRows);
        renderManagerActions({ total, done, pending, doing, review, backlog, other, withoutOwner, shared, impediments: countNoType(filteredRows) });
        renderManagerFronts(filteredRows);
    }

    function renderManagerPeople(filteredRows) {
        const people = new Map();
        const selectedPerson = selectedManagerPerson();

        filteredRows.forEach(row => {
            const rowMembers = splitMembers(row.dataset.person);
            const members = selectedPerson ? rowMembers.filter(member => member === selectedPerson) : rowMembers;

            members.forEach(member => {
                if (!people.has(member)) {
                    people.set(member, { total: 0, done: 0, doing: 0, review: 0, shared: 0 });
                }

                const person = people.get(member);
                const group = row.dataset.statusGroup;
                person.total++;

                if (rowMembers.length > 1) {
                    person.shared++;
                }

                if (group === 'done') {
                    person.done++;
                }

                if (group === 'doing') {
                    person.doing++;
                }

                if (group === 'review') {
                    person.review++;
                }
            });
        });

        managerPeopleBody.innerHTML = Array.from(people.entries())
            .sort((left, right) => deliveryPercent(right[1].done, right[1].total) - deliveryPercent(left[1].done, left[1].total)
                    || right[1].total - left[1].total
                    || left[0].localeCompare(right[0]))
            .map(([name, person]) => {
                const pending = person.total - person.done;

                return `
                    <tr>
                        <td><button class="person-filter-button" type="button" data-person-filter="${escapeHtml(name)}">${escapeHtml(name)}</button></td>
                        <td>${person.total}</td>
                        <td>${person.done}</td>
                        <td>${person.doing}</td>
                        <td>${person.review}</td>
                        <td>${pending}</td>
                        <td>${person.shared}</td>
                        <td><span class="delivery-pill">${deliveryPercent(person.done, person.total)}%</span></td>
                    </tr>
                `;
            })
            .join('') || '<tr><td colspan="8">Nenhum responsavel encontrado para o filtro.</td></tr>';
    }

    function renderManagerActions(counters) {
        const actions = [];

        if (counters.withoutOwner > 0) {
            actions.push(managerAction('Definir responsaveis', counters.withoutOwner, 'cards filtrados ainda nao tem dono.', 'danger'));
        }

        if (selectedManagerPerson() && counters.shared > 0) {
            actions.push(managerAction('Tarefas em conjunto', counters.shared, 'cards da pessoa filtrada tambem possuem outros responsaveis.', 'neutral'));
        }

        if (counters.backlog > 0) {
            actions.push(managerAction('Priorizar backlog', counters.backlog, 'cards filtrados ainda estao aguardando priorizacao.', 'neutral'));
        }

        if (counters.other > 0) {
            actions.push(managerAction('Status fora do padrao', counters.other, 'cards filtrados estao fora dos status operacionais conhecidos.', 'neutral'));
        }

        if (counters.review > 0) {
            actions.push(managerAction('Destravar review', counters.review, 'cards filtrados aguardam validacao.', 'warning'));
        }

        if (counters.doing > 0) {
            actions.push(managerAction('Acompanhar execucao', counters.doing, 'cards filtrados estao em andamento.', 'warning'));
        }

        if (counters.impediments > 0) {
            actions.push(managerAction('Remover impedimentos', counters.impediments, 'features filtradas possuem etiqueta Impediment.', 'danger'));
        }

        if (!actions.length && counters.total > 0) {
            actions.push(managerAction('Recorte sem alerta principal', counters.done, 'todos os cards filtrados estao entregues ou sem pendencia evidente.', 'success'));
        }

        if (counters.total === 0) {
            actions.push(managerAction('Nenhum card encontrado', 0, 'ajuste os filtros para ver indicadores gerenciais.', 'neutral'));
        }

        managerActionList.innerHTML = actions.map(action => `
            <article class="manager-action ${action.severity}">
                <strong>${escapeHtml(action.title)}</strong>
                <span>${action.total}</span>
                <p>${escapeHtml(action.note)}</p>
            </article>
        `).join('');
    }

    function renderManagerFronts(filteredRows) {
        const fronts = new Map();

        filteredRows.forEach(row => {
            const front = row.dataset.front || 'Sem frente';

            if (!fronts.has(front)) {
                fronts.set(front, { total: 0, done: 0 });
            }

            const counter = fronts.get(front);
            counter.total++;

            if (row.dataset.statusGroup === 'done') {
                counter.done++;
            }
        });

        managerFrontBody.innerHTML = Array.from(fronts.entries())
            .sort((left, right) => right[1].total - left[1].total || left[0].localeCompare(right[0]))
            .map(([front, counter]) => {
                const pending = counter.total - counter.done;

                return `
                    <tr>
                        <td>${escapeHtml(front)}</td>
                        <td>${counter.total}</td>
                        <td>${counter.done}</td>
                        <td>${pending}</td>
                        <td><span class="delivery-pill">${deliveryPercent(counter.done, counter.total)}%</span></td>
                    </tr>
                `;
            })
            .join('') || '<tr><td colspan="5">Nenhuma frente encontrada para o filtro.</td></tr>';
    }

    function managerAction(title, total, note, severity) {
        return { title, total, note, severity };
    }

    function updateSummary(label, value, note, severity) {
        const card = summaryCards.find(item => item.dataset.summary === label);

        if (!card) {
            return;
        }

        card.className = 'summary-card' + (severity ? ` ${severity}` : '');
        card.querySelector('.summary-value').textContent = value;
        card.querySelector('.summary-note').textContent = note;
    }

    function resetFilters() {
        searchInput.value = '';
        personFilter.value = '';
        listFilter.value = '';
        frontFilter.value = '';
        conditionFilter.value = '';
        withoutOwnerFilter.checked = false;
        includeArchivedFilter.checked = false;
    }

    function setManagerMode(active) {
        managerMode = active;
        localStorage.setItem(MANAGER_MODE_KEY, String(managerMode));
        updateViewMode();
    }

    function updateViewMode() {
        managerView.classList.toggle('hidden', !managerMode);
        operationalView.classList.toggle('hidden', managerMode);
        managerViewToggle.textContent = managerMode ? 'Voltar para visao operacional' : 'Ativar visao gerencial';
        managerViewToggle.classList.toggle('active', managerMode);
    }

    function applyPersonFilter(person) {
        if (!person) {
            return;
        }

        searchInput.value = '';
        withoutOwnerFilter.checked = false;
        personFilter.value = person;
        applyFilters();
    }

    function applyQuickAction(action) {
        resetFilters();

        if (action === 'without-owner') {
            withoutOwnerFilter.checked = true;
        }

        if (action === 'doing') {
            listFilter.value = 'Doing';
        }

        if (action === 'backlog') {
            listFilter.value = 'Backlog';
        }

        if (action === 'rhp') {
            frontFilter.value = 'RHP';
        }

        if (action === 'susboot') {
            frontFilter.value = 'SusBoot';
        }

        if (action === 'impediment') {
            conditionFilter.value = 'Feature impedida';
        }

        applyFilters();
    }

    function exportFilteredCsv() {
        const rows = Array.from(document.querySelectorAll('.card-row'))
            .filter(row => !row.hidden);

        if (!rows.length) {
            showMessage('Nenhum card visivel para exportar.', 'error');
            return;
        }

        const header = ['Card', 'Lista', 'Responsavel', 'Tipo', 'Ultima atividade'];
        const lines = rows.map(row => [
            row.querySelector('.card-title').textContent,
            row.dataset.list,
            row.dataset.person,
            row.dataset.type,
            row.dataset.lastActivity || 'Sem data'
        ]);
        const csv = [header].concat(lines)
            .map(columns => columns.map(csvValue).join(';'))
            .join('\r\n');
        const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');

        link.href = url;
        link.download = 'fatureasy-trace-cards.csv';
        link.click();
        URL.revokeObjectURL(url);
        showMessage('CSV exportado com os cards visiveis.', 'success');
    }

    function showMessage(message, type) {
        importMessage.textContent = message;
        importMessage.className = `message ${type === 'error' ? 'error-message' : 'success-message'}`;
    }

    function listGroup(listName) {
        const value = normalize(listName);

        if (value.includes('backlog')) {
            return 'backlog';
        }

        if (value.includes('to do') || value.includes('todo') || value.includes('a fazer')) {
            return 'todo';
        }

        if (value.includes('doing') || value.includes('em andamento') || value.includes('execucao')) {
            return 'doing';
        }

        if (value.includes('review') || value.includes('revisao') || value.includes('validacao')) {
            return 'review';
        }

        if (value.includes('done') || value.includes('concluido') || value.includes('entregue') || value.includes('finalizado')) {
            return 'done';
        }

        return 'other';
    }

    function countByGroup(rows, group) {
        return rows.filter(row => row.dataset.statusGroup === group).length;
    }

    function countNoType(rows) {
        return rows.filter(row => row.dataset.condition === 'Feature impedida').length;
    }

    function countShared(rows) {
        return rows.filter(row => splitMembers(row.dataset.person).length > 1).length;
    }

    function archivedCardsCount() {
        return dashboard.cards.filter(card => card.listClosed).length;
    }

    function deliveryPercent(done, total) {
        return total ? Math.round((done / total) * 100) : 0;
    }

    function managerScopeText(total, shared) {
        const filters = [];

        if (searchInput.value.trim()) {
            filters.push(`busca "${searchInput.value.trim()}"`);
        }

        if (personFilter.value) {
            filters.push(`responsavel ${personFilter.value}`);
        }

        if (listFilter.value) {
            filters.push(`lista ${listFilter.value}`);
        }

        if (frontFilter.value) {
            filters.push(`frente ${frontFilter.value}`);
        }

        if (conditionFilter.value) {
            filters.push(`condicao ${conditionFilter.value}`);
        }

        if (withoutOwnerFilter.checked) {
            filters.push('sem responsavel');
        }

        if (includeArchivedFilter.checked) {
            filters.push('historico arquivado incluido');
        }

        if (!filters.length) {
            return includeArchivedFilter.checked
                ? `${total} cards do quadro atual e do historico arquivado.`
                : `${total} cards no quadro atual do Trello.`;
        }

        const text = `${total} cards encontrados com ${filters.join(', ')}.`;

        if (selectedManagerPerson() && shared > 0) {
            return `${text} ${shared} deles estao em conjunto com outros responsaveis.`;
        }

        return text;
    }

    function selectedManagerPerson() {
        if (personFilter.value) {
            return personFilter.value;
        }

        const search = normalize(searchInput.value.trim());

        if (!search) {
            return '';
        }

        const people = unique(dashboard.cards.flatMap(card => card.owners))
            .filter(person => normalize(person).includes(search));

        return people.length === 1 ? people[0] : '';
    }

    function workflowNote(group) {
        if (group === 'backlog') {
            return 'entrada ainda nao priorizada';
        }

        if (group === 'todo') {
            return 'selecionado para trabalho';
        }

        if (group === 'doing') {
            return 'em execucao agora';
        }

        if (group === 'review') {
            return 'aguardando validacao';
        }

        if (group === 'done') {
            return 'entregas concluidas';
        }

        return 'status importado do Trello';
    }

    function severityForStatus(status) {
        return statusGroupFromLabel(status) === 'doing'
            ? 'warning'
            : statusGroupFromLabel(status) === 'done'
                ? 'success'
                : 'neutral';
    }

    function statusGroupFromLabel(status) {
        return listGroup(status);
    }

    function splitMembers(value) {
        return (value || '')
            .split(',')
            .map(member => member.trim())
            .filter(member => member.length > 0);
    }

    function mainType(types) {
        let selected = 'Feature';
        let selectedTotal = -1;

        types.forEach((total, type) => {
            if (total > selectedTotal || (total === selectedTotal && type.localeCompare(selected) < 0)) {
                selected = type;
                selectedTotal = total;
            }
        });

        return selected;
    }

    function formatDate(value) {
        if (!value) {
            return 'Sem data';
        }

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return 'Sem data';
        }

        return date.toLocaleDateString('pt-BR');
    }

    function csvValue(value) {
        return `"${String(value || '').replace(/"/g, '""')}"`;
    }

    function unique(values) {
        return Array.from(new Set(values));
    }

    function normalize(value) {
        return (value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }

    function escapeHtml(value) {
        return String(value || '').replace(/[&<>"']/g, character => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        }[character]));
    }

    function emptyDashboard() {
        return {
            imported: false,
            sourceFile: '',
            importedAt: '',
            cards: [],
            listOrder: []
        };
    }
})();
