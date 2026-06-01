(function () {
    const STORAGE_KEY = 'fatureasy.trace.dashboard';
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
    const typeFilter = document.getElementById('typeFilter');
    const withoutOwnerFilter = document.getElementById('withoutOwnerFilter');
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
    let managerMode = false;

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

    [searchInput, personFilter, listFilter, typeFilter, withoutOwnerFilter].forEach(input => {
        input.addEventListener('input', applyFilters);
        input.addEventListener('change', applyFilters);
    });

    clearFilters.addEventListener('click', () => {
        resetFilters();
        applyFilters();
    });

    exportCsv.addEventListener('click', exportFilteredCsv);

    managerViewToggle.addEventListener('click', () => {
        managerMode = !managerMode;
        updateViewMode();
        applyFilters();
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
        } catch (error) {
            localStorage.removeItem(STORAGE_KEY);
            dashboard = emptyDashboard();
        }

        renderDashboard();
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
                name: displayListName(list.name || 'Lista sem nome'),
                position: Number(list.pos || 999999)
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
        const list = lists.get(card.idList) || { name: 'Lista nao encontrada' };
        const name = card.name || 'Card sem titulo';
        const lastActivity = formatDate(card.dateLastActivity);
        const resolvedOwners = owners.length ? owners : [WITHOUT_OWNER];

        return {
            name: name,
            url: card.shortUrl || card.url || '',
            listName: list.name,
            owners: resolvedOwners,
            labels: labels,
            type: cardType(name, labels),
            lastActivity: lastActivity,
            lastActivityRaw: card.dateLastActivity || '',
            withoutOwner: resolvedOwners.length === 1 && resolvedOwners[0] === WITHOUT_OWNER,
            search: normalize([name, resolvedOwners.join(' '), labels.join(' '), list.name, lastActivity].join(' '))
        };
    }

    function cardType(name, labels) {
        const prefix = prefixFromName(name);
        const label = labels.length ? labels[0] : 'Outro';

        if (!prefix) {
            return label;
        }

        return label === 'Outro' ? prefix : `${prefix} ${label}`;
    }

    function prefixFromName(name) {
        const match = (name || '').match(/^\[[^\]]+]/);
        return match ? match[0] : '';
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
            ? `Fonte atual: ${dashboard.sourceFile} - ${dashboard.importedAt}`
            : 'Fonte atual: nenhum arquivo importado';
        emptyState.classList.toggle('hidden', dashboard.imported);
        dashboardContent.classList.toggle('hidden', !dashboard.imported);

        updateViewMode();
        populateFilters();
        renderQuickActions();
        renderRows();
        applyFilters();
    }

    function populateFilters() {
        fillSelect(personFilter, 'Todas as pessoas', unique(dashboard.cards.flatMap(card => card.owners)).sort());
        fillSelect(listFilter, 'Todas as listas', dashboard.listOrder || []);
        fillSelect(typeFilter, 'Todos os tipos', unique(dashboard.cards.map(card => card.type)).sort());
    }

    function fillSelect(select, label, values) {
        select.innerHTML = `<option value="">${label}</option>` + values
            .map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`)
            .join('');
    }

    function renderRows() {
        cardRowsBody.innerHTML = dashboard.cards.map(card => `
            <tr class="card-row"
                data-search="${escapeHtml(card.search)}"
                data-person="${escapeHtml(card.owners.join(', '))}"
                data-list="${escapeHtml(card.listName)}"
                data-type="${escapeHtml(card.type)}"
                data-last-activity="${escapeHtml(card.lastActivity || 'Sem data')}"
                data-without-owner="${card.withoutOwner}">
                <td>${card.url ? `<a class="card-title" href="${escapeHtml(card.url)}" target="_blank">${escapeHtml(card.name)}</a>` : `<span class="card-title">${escapeHtml(card.name)}</span>`}</td>
                <td>${escapeHtml(card.listName)}</td>
                <td>${escapeHtml(card.owners.join(', '))}</td>
                <td><span class="table-badge">${escapeHtml(card.type)}</span></td>
                <td>${escapeHtml(card.lastActivity || 'Sem data')}</td>
            </tr>
        `).join('');
    }

    function applyFilters() {
        const rows = Array.from(document.querySelectorAll('.card-row'));
        const search = normalize(searchInput.value);
        const person = personFilter.value;
        const list = listFilter.value;
        const type = typeFilter.value;
        const onlyWithoutOwner = withoutOwnerFilter.checked;
        const filteredRows = [];

        rows.forEach(row => {
            const show = (!search || row.dataset.search.includes(search))
                && (!person || row.dataset.person.includes(person))
                && (!list || row.dataset.list === list)
                && (!type || row.dataset.type === type)
                && (!onlyWithoutOwner || row.dataset.withoutOwner === 'true');

            row.hidden = !show;

            if (show) {
                filteredRows.push(row);
            }
        });

        visibleCards.textContent = filteredRows.length;

        const withoutOwner = filteredRows.filter(row => row.dataset.withoutOwner === 'true').length;
        const doing = filteredRows.filter(row => listGroup(row.dataset.list) === 'doing').length;
        const done = filteredRows.filter(row => listGroup(row.dataset.list) === 'done').length;

        updateSummary('Total no JSON', dashboard.cards.length, dashboard.imported ? 'cards abertos no arquivo importado' : 'importe um JSON para iniciar', '');
        updateSummary('Resultado do filtro', filteredRows.length, dashboard.imported ? 'cards que batem com os filtros atuais' : 'sem dados importados', '');
        updateSummary('Sem responsavel no filtro', withoutOwner, dashboard.imported ? 'cards filtrados sem dono' : 'sem dados importados', withoutOwner > 0 ? 'danger' : 'neutral');
        updateSummary('Done no filtro', done, dashboard.imported ? 'cards filtrados em Done' : 'sem dados importados', dashboard.imported ? 'success' : 'neutral');
        updateSummary('Doing no filtro', doing, dashboard.imported ? 'cards filtrados em Doing' : 'sem dados importados', dashboard.imported ? 'warning' : 'neutral');

        renderWorkflow(filteredRows);
        renderCharts(filteredRows);
        renderPeople(filteredRows);
        renderTypes(filteredRows);
        renderManagerView(filteredRows);
    }

    function renderQuickActions() {
        if (!dashboard.imported || !dashboard.cards.length) {
            actionList.innerHTML = '';
            return;
        }

        const actions = [
            {
                action: 'without-owner',
                label: 'Sem responsavel no quadro',
                total: dashboard.cards.filter(card => card.withoutOwner).length,
                note: 'cards que precisam de dono'
            },
            {
                action: 'doing',
                label: 'Doing no quadro',
                total: dashboard.cards.filter(card => listGroup(card.listName) === 'doing').length,
                note: 'trabalho aberto agora'
            },
            {
                action: 'backlog',
                label: 'Backlog no quadro',
                total: dashboard.cards.filter(card => listGroup(card.listName) === 'backlog').length,
                note: 'entrada para priorizacao'
            },
            {
                action: 'rhp',
                label: '[RHP] no quadro',
                total: dashboard.cards.filter(card => card.type.includes('[RHP]') || card.name.startsWith('[RHP]')).length,
                note: 'cards dessa frente'
            },
            {
                action: 'no-type',
                label: 'Sem tipo no quadro',
                total: dashboard.cards.filter(card => card.type === 'Outro').length,
                note: 'sem etiqueta de tipo'
            }
        ];

        actionList.innerHTML = actions.map(action => `
            <button class="quick-action" type="button" data-action="${action.action}">
                <span>${escapeHtml(action.label)}</span>
                <strong>${action.total}</strong>
                <small>${escapeHtml(action.note)}</small>
            </button>
        `).join('');
    }

    function renderWorkflow(filteredRows) {
        const counts = new Map();
        filteredRows.forEach(row => counts.set(row.dataset.list, (counts.get(row.dataset.list) || 0) + 1));

        const names = (dashboard.listOrder || [])
            .filter(name => counts.has(name));

        workflowGrid.innerHTML = names.map(name => `
            <article class="workflow-card ${severityForList(name)}" data-list="${escapeHtml(name)}">
                <span class="workflow-title">${escapeHtml(name)}</span>
                <strong>${counts.get(name)}</strong>
                <span>${workflowNote(name)}</span>
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
        const done = filteredRows.filter(row => listGroup(row.dataset.list) === 'done').length;
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
        const stages = [
            { group: 'backlog', label: 'Backlog', color: 'primary' },
            { group: 'todo', label: 'To Do', color: 'secondary' },
            { group: 'doing', label: 'Doing', color: 'warning' },
            { group: 'review', label: 'Review', color: 'danger' },
            { group: 'done', label: 'Done', color: 'success' }
        ];
        const counts = stages.map(stage => ({
            ...stage,
            total: filteredRows.filter(row => listGroup(row.dataset.list) === stage.group).length
        }));
        const max = Math.max(...counts.map(stage => stage.total), 1);

        stageChart.innerHTML = counts.map(stage => chartBar(stage.label, stage.total, max, stage.color)).join('');
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
            ? rows.map(([name, total]) => chartBar(name, total, max, 'secondary')).join('')
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

    function emptyChart(message) {
        return `<div class="chart-empty">${message}</div>`;
    }

    function renderPeople(filteredRows) {
        const people = new Map();

        filteredRows.forEach(row => {
            splitMembers(row.dataset.person).forEach(member => {
                if (!people.has(member)) {
                    people.set(member, { total: 0, backlog: 0, todo: 0, doing: 0, review: 0, done: 0, types: new Map() });
                }

                const person = people.get(member);
                const group = listGroup(row.dataset.list);
                person.total++;
                person.types.set(row.dataset.type, (person.types.get(row.dataset.type) || 0) + 1);

                if (group !== 'other') {
                    person[group]++;
                }
            });
        });

        personWorkloadBody.innerHTML = Array.from(people.entries())
            .sort((left, right) => right[1].total - left[1].total || left[0].localeCompare(right[0]))
            .map(([name, person]) => `
                <tr>
                    <td>${escapeHtml(name)}</td>
                    <td>${person.total}</td>
                    <td>${person.backlog}</td>
                    <td>${person.todo}</td>
                    <td>${person.doing}</td>
                    <td>${person.review}</td>
                    <td>${person.done}</td>
                    <td>${escapeHtml(mainType(person.types))}</td>
                </tr>
            `)
            .join('') || '<tr><td colspan="8">Nenhum card encontrado para o filtro.</td></tr>';
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
                    <td>${type === 'Outro' ? 'sem etiqueta de tipo no card' : 'tipo encontrado no Trello'}</td>
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
        const withoutOwner = filteredRows.filter(row => row.dataset.withoutOwner === 'true').length;
        const pending = total - done;
        const percent = deliveryPercent(done, total);

        managerScope.textContent = managerScopeText(total);
        managerDeliveryPercent.textContent = `${percent}%`;
        managerDone.textContent = done;
        managerDoneNote.textContent = `${done} de ${total} cards em Done`;
        managerPending.textContent = pending;
        managerDoing.textContent = doing;
        managerReview.textContent = review;
        managerWithoutOwner.textContent = withoutOwner;
        managerBacklog.textContent = backlog;

        renderManagerPeople(filteredRows);
        renderManagerActions({ total, done, pending, doing, review, backlog, withoutOwner, noType: countNoType(filteredRows) });
        renderManagerFronts(filteredRows);
    }

    function renderManagerPeople(filteredRows) {
        const people = new Map();

        filteredRows.forEach(row => {
            splitMembers(row.dataset.person).forEach(member => {
                if (!people.has(member)) {
                    people.set(member, { total: 0, done: 0, doing: 0, review: 0 });
                }

                const person = people.get(member);
                const group = listGroup(row.dataset.list);
                person.total++;

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
                        <td>${escapeHtml(name)}</td>
                        <td>${person.total}</td>
                        <td>${person.done}</td>
                        <td>${person.doing}</td>
                        <td>${person.review}</td>
                        <td>${pending}</td>
                        <td><span class="delivery-pill">${deliveryPercent(person.done, person.total)}%</span></td>
                    </tr>
                `;
            })
            .join('') || '<tr><td colspan="7">Nenhum responsavel encontrado para o filtro.</td></tr>';
    }

    function renderManagerActions(counters) {
        const actions = [];

        if (counters.withoutOwner > 0) {
            actions.push(managerAction('Definir responsaveis', counters.withoutOwner, 'cards filtrados ainda nao tem dono.', 'danger'));
        }

        if (counters.backlog > 0) {
            actions.push(managerAction('Priorizar backlog', counters.backlog, 'cards filtrados ainda estao aguardando priorizacao.', 'neutral'));
        }

        if (counters.review > 0) {
            actions.push(managerAction('Destravar review', counters.review, 'cards filtrados aguardam validacao.', 'warning'));
        }

        if (counters.doing > 0) {
            actions.push(managerAction('Acompanhar execucao', counters.doing, 'cards filtrados estao em andamento.', 'warning'));
        }

        if (counters.noType > 0) {
            actions.push(managerAction('Classificar tipo', counters.noType, 'cards filtrados estao sem tipo claro.', 'neutral'));
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
            const title = row.querySelector('.card-title').textContent;
            const front = prefixFromName(title) || prefixFromName(row.dataset.type) || 'Sem frente';

            if (!fronts.has(front)) {
                fronts.set(front, { total: 0, done: 0 });
            }

            const counter = fronts.get(front);
            counter.total++;

            if (listGroup(row.dataset.list) === 'done') {
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
        typeFilter.value = '';
        withoutOwnerFilter.checked = false;
    }

    function updateViewMode() {
        managerView.classList.toggle('hidden', !managerMode);
        operationalView.classList.toggle('hidden', managerMode);
        managerViewToggle.textContent = managerMode ? 'Voltar para visao operacional' : 'Ativar visao gerencial';
        managerViewToggle.classList.toggle('active', managerMode);
    }

    function applyQuickAction(action) {
        resetFilters();

        if (action === 'without-owner') {
            withoutOwnerFilter.checked = true;
        }

        if (action === 'doing') {
            selectFirstListByGroup('doing');
        }

        if (action === 'backlog') {
            selectFirstListByGroup('backlog');
        }

        if (action === 'rhp') {
            searchInput.value = '[RHP]';
        }

        if (action === 'no-type') {
            typeFilter.value = 'Outro';
        }

        applyFilters();
    }

    function selectFirstListByGroup(group) {
        const option = Array.from(listFilter.options)
            .find(item => item.value && listGroup(item.value) === group);

        if (option) {
            listFilter.value = option.value;
        }
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

        if (value.includes('to do') || value.includes('todo')) {
            return 'todo';
        }

        if (value.includes('doing')) {
            return 'doing';
        }

        if (value.includes('review')) {
            return 'review';
        }

        if (value.includes('done')) {
            return 'done';
        }

        return 'other';
    }

    function countByGroup(rows, group) {
        return rows.filter(row => listGroup(row.dataset.list) === group).length;
    }

    function countNoType(rows) {
        return rows.filter(row => row.dataset.type === 'Outro').length;
    }

    function deliveryPercent(done, total) {
        return total ? Math.round((done / total) * 100) : 0;
    }

    function managerScopeText(total) {
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

        if (typeFilter.value) {
            filters.push(`tipo ${typeFilter.value}`);
        }

        if (withoutOwnerFilter.checked) {
            filters.push('sem responsavel');
        }

        if (!filters.length) {
            return `${total} cards abertos do JSON importado.`;
        }

        return `${total} cards encontrados com ${filters.join(', ')}.`;
    }

    function workflowNote(listName) {
        const group = listGroup(listName);

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

        return 'lista importada do Trello';
    }

    function severityForList(listName) {
        return listGroup(listName) === 'doing'
            ? 'warning'
            : listGroup(listName) === 'done'
                ? 'success'
                : 'neutral';
    }

    function displayListName(listName) {
        return listGroup(listName) === 'done' ? 'Done' : listName;
    }

    function splitMembers(value) {
        return (value || '')
            .split(',')
            .map(member => member.trim())
            .filter(member => member.length > 0);
    }

    function mainType(types) {
        let selected = 'Sem tipo';
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
