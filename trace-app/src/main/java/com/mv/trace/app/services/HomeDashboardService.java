package com.mv.trace.app.services;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mv.trace.app.views.HomeDashboardView;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TreeSet;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;
import java.util.stream.StreamSupport;

@Service
public class HomeDashboardService {

    private static final String WITHOUT_OWNER = "Sem responsavel";
    private static final DateTimeFormatter IMPORT_DATE_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    private final ObjectMapper objectMapper;

    public HomeDashboardService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public HomeDashboardView importDashboard(String sourceFile, InputStream inputStream) throws IOException {
        JsonNode root = objectMapper.readTree(inputStream);
        JsonNode cardsNode = root.path("cards");

        if (!cardsNode.isArray()) {
            throw new IllegalArgumentException("Invalid Trello JSON");
        }

        Map<String, ListInfo> lists = readLists(root.path("lists"));
        Map<String, String> members = readMembers(root.path("members"));
        List<CardData> cards = readCards(cardsNode, lists, members);

        return buildDashboard(sourceFile, cards, lists);
    }

    private HomeDashboardView buildDashboard(String sourceFile, List<CardData> cards, Map<String, ListInfo> lists) {
        int totalCards = cards.size();
        long doingCards = cards.stream().filter(card -> isDoing(card.listName())).count();
        long doneCards = cards.stream().filter(card -> isDone(card.listName())).count();
        long withoutOwnerCards = cards.stream().filter(CardData::withoutOwner).count();

        return new HomeDashboardView(
                sourceFile == null || sourceFile.isBlank() ? "Arquivo importado" : sourceFile,
                LocalDateTime.now().format(IMPORT_DATE_FORMAT),
                true,
                List.of(
                        new HomeDashboardView.SummaryCard("Total no JSON", String.valueOf(totalCards), "cards abertos no arquivo importado", ""),
                        new HomeDashboardView.SummaryCard("Resultado do filtro", String.valueOf(totalCards), "cards que batem com os filtros atuais", ""),
                        new HomeDashboardView.SummaryCard("Sem responsavel no filtro", String.valueOf(withoutOwnerCards), "cards filtrados sem dono", withoutOwnerCards > 0 ? "danger" : "neutral"),
                        new HomeDashboardView.SummaryCard("Done no filtro", String.valueOf(doneCards), "cards filtrados em Done", "success"),
                        new HomeDashboardView.SummaryCard("Doing no filtro", String.valueOf(doingCards), "cards filtrados em Doing", "warning")
                ),
                workflowColumns(cards, lists),
                personWorkloads(cards),
                cardTypeCounts(cards),
                cardRows(cards),
                personFilters(cards),
                listFilters(cards, lists),
                typeFilters(cards)
        );
    }

    private List<HomeDashboardView.WorkflowColumn> workflowColumns(List<CardData> cards, Map<String, ListInfo> lists) {
        Map<String, Long> countByList = cards.stream()
                .collect(Collectors.groupingBy(CardData::listName, LinkedHashMap::new, Collectors.counting()));

        List<String> listNames = lists.values().stream()
                .sorted(Comparator.comparingDouble(ListInfo::position))
                .map(ListInfo::name)
                .filter(name -> countByList.containsKey(name))
                .collect(Collectors.toCollection(ArrayList::new));

        countByList.keySet().stream()
                .filter(name -> !listNames.contains(name))
                .sorted()
                .forEach(listNames::add);

        return listNames.stream()
                .map(name -> new HomeDashboardView.WorkflowColumn(
                        name,
                        countByList.getOrDefault(name, 0L).intValue(),
                        workflowNote(name),
                        severityForList(name)
                ))
                .toList();
    }

    private List<HomeDashboardView.PersonWorkload> personWorkloads(List<CardData> cards) {
        Map<String, PersonCounter> counters = new HashMap<>();

        for (CardData card : cards) {
            for (String owner : card.owners()) {
                PersonCounter counter = counters.computeIfAbsent(owner, ignored -> new PersonCounter());
                counter.total.incrementAndGet();
                counter.types.merge(card.type(), 1, Integer::sum);

                if (isBacklog(card.listName())) {
                    counter.backlog.incrementAndGet();
                } else if (isTodo(card.listName())) {
                    counter.todo.incrementAndGet();
                } else if (isDoing(card.listName())) {
                    counter.doing.incrementAndGet();
                } else if (isReview(card.listName())) {
                    counter.review.incrementAndGet();
                } else if (isDone(card.listName())) {
                    counter.done.incrementAndGet();
                }
            }
        }

        return counters.entrySet().stream()
                .map(entry -> new HomeDashboardView.PersonWorkload(
                        entry.getKey(),
                        entry.getValue().total.get(),
                        entry.getValue().backlog.get(),
                        entry.getValue().todo.get(),
                        entry.getValue().doing.get(),
                        entry.getValue().review.get(),
                        entry.getValue().done.get(),
                        mainType(entry.getValue().types)
                ))
                .sorted(Comparator.comparing(HomeDashboardView.PersonWorkload::total).reversed()
                        .thenComparing(HomeDashboardView.PersonWorkload::name))
                .toList();
    }

    private List<HomeDashboardView.CardTypeCount> cardTypeCounts(List<CardData> cards) {
        Map<String, Long> countByType = cards.stream()
                .collect(Collectors.groupingBy(CardData::type, Collectors.counting()));

        return countByType.entrySet().stream()
                .map(entry -> new HomeDashboardView.CardTypeCount(entry.getKey(), entry.getValue().intValue(), typeNote(entry.getKey())))
                .sorted(Comparator.comparing(HomeDashboardView.CardTypeCount::total).reversed()
                        .thenComparing(HomeDashboardView.CardTypeCount::name))
                .toList();
    }

    private List<HomeDashboardView.CardRow> cardRows(List<CardData> cards) {
        return cards.stream()
                .map(card -> new HomeDashboardView.CardRow(
                        card.name(),
                        card.url(),
                        card.listName(),
                        String.join(", ", card.owners()),
                        card.type(),
                        String.join(", ", card.labels()),
                        card.lastActivity(),
                        card.withoutOwner()
                ))
                .toList();
    }

    private List<String> personFilters(List<CardData> cards) {
        return cards.stream()
                .flatMap(card -> card.owners().stream())
                .collect(Collectors.toCollection(TreeSet::new))
                .stream()
                .toList();
    }

    private List<String> listFilters(List<CardData> cards, Map<String, ListInfo> lists) {
        List<String> names = lists.values().stream()
                .sorted(Comparator.comparingDouble(ListInfo::position))
                .map(ListInfo::name)
                .filter(name -> cards.stream().anyMatch(card -> card.listName().equals(name)))
                .collect(Collectors.toCollection(ArrayList::new));

        cards.stream()
                .map(CardData::listName)
                .filter(name -> !names.contains(name))
                .distinct()
                .sorted()
                .forEach(names::add);

        return names;
    }

    private List<String> typeFilters(List<CardData> cards) {
        return cards.stream()
                .map(CardData::type)
                .collect(Collectors.toCollection(TreeSet::new))
                .stream()
                .toList();
    }

    private List<CardData> readCards(JsonNode cardsNode, Map<String, ListInfo> lists, Map<String, String> members) {
        List<CardData> cards = new ArrayList<>();

        for (JsonNode cardNode : cardsNode) {
            if (cardNode.path("closed").asBoolean(false)) {
                continue;
            }

            List<String> owners = readOwners(cardNode.path("idMembers"), members);
            List<String> labels = readLabels(cardNode.path("labels"));
            String listName = displayListName(lists.getOrDefault(cardNode.path("idList").asText(), new ListInfo("Lista nao encontrada", 999999)).name());
            String name = cardNode.path("name").asText("Card sem titulo");

            cards.add(new CardData(
                    name,
                    listName,
                    owners,
                    labels,
                    cardType(name, labels),
                    cardNode.path("dateLastActivity").asText("Sem data"),
                    cardNode.path("shortUrl").asText("")
            ));
        }

        return cards;
    }

    private Map<String, ListInfo> readLists(JsonNode listsNode) {
        Map<String, ListInfo> lists = new LinkedHashMap<>();

        if (!listsNode.isArray()) {
            return lists;
        }

        for (JsonNode listNode : listsNode) {
            lists.put(listNode.path("id").asText(), new ListInfo(
                    listNode.path("name").asText("Lista sem nome"),
                    listNode.path("pos").asDouble(999999)
            ));
        }

        return lists;
    }

    private Map<String, String> readMembers(JsonNode membersNode) {
        Map<String, String> members = new HashMap<>();

        if (!membersNode.isArray()) {
            return members;
        }

        for (JsonNode memberNode : membersNode) {
            members.put(memberNode.path("id").asText(), memberName(memberNode));
        }

        return members;
    }

    private List<String> readOwners(JsonNode idMembersNode, Map<String, String> members) {
        if (!idMembersNode.isArray() || idMembersNode.isEmpty()) {
            return List.of(WITHOUT_OWNER);
        }

        List<String> owners = StreamSupport.stream(idMembersNode.spliterator(), false)
                .map(JsonNode::asText)
                .map(id -> members.getOrDefault(id, id))
                .filter(name -> !name.isBlank())
                .toList();

        return owners.isEmpty() ? List.of(WITHOUT_OWNER) : owners;
    }

    private List<String> readLabels(JsonNode labelsNode) {
        if (!labelsNode.isArray()) {
            return List.of();
        }

        return StreamSupport.stream(labelsNode.spliterator(), false)
                .map(label -> label.path("name").asText())
                .filter(name -> !name.isBlank())
                .toList();
    }

    private String memberName(JsonNode memberNode) {
        String fullName = memberNode.path("fullName").asText();
        return fullName.isBlank() ? memberNode.path("username").asText("Membro sem nome") : fullName;
    }

    private String cardType(String name, List<String> labels) {
        String prefix = prefixFromName(name);
        String label = labels.isEmpty() ? "Outro" : labels.get(0);

        if (prefix.isBlank()) {
            return label;
        }

        return "Outro".equals(label) ? prefix : prefix + " " + label;
    }

    private String prefixFromName(String name) {
        if (name == null) {
            return "";
        }

        int start = name.indexOf('[');
        int end = name.indexOf(']');
        return start == 0 && end > 1 ? name.substring(start, end + 1) : "";
    }

    private String mainType(Map<String, Integer> types) {
        return types.entrySet().stream()
                .max(Map.Entry.<String, Integer>comparingByValue().thenComparing(Map.Entry.comparingByKey()))
                .map(Map.Entry::getKey)
                .orElse("Sem tipo");
    }

    private String workflowNote(String listName) {
        if (isBacklog(listName)) {
            return "entrada ainda nao priorizada";
        }

        if (isTodo(listName)) {
            return "selecionado para trabalho";
        }

        if (isDoing(listName)) {
            return "em execucao agora";
        }

        if (isReview(listName)) {
            return "aguardando validacao";
        }

        if (isDone(listName)) {
            return "entregas concluidas";
        }

        return "lista importada do Trello";
    }

    private String displayListName(String listName) {
        return isDone(listName) ? "Done" : listName;
    }

    private String severityForList(String listName) {
        if (isDoing(listName)) {
            return "warning";
        }

        if (isDone(listName)) {
            return "success";
        }

        return "neutral";
    }

    private String typeNote(String type) {
        if ("Outro".equals(type)) {
            return "sem etiqueta de tipo no card";
        }

        return "tipo encontrado no Trello";
    }

    private boolean isBacklog(String listName) {
        return normalized(listName).contains("backlog");
    }

    private boolean isTodo(String listName) {
        String normalized = normalized(listName);
        return normalized.contains("to do") || normalized.contains("todo");
    }

    private boolean isDoing(String listName) {
        return normalized(listName).contains("doing");
    }

    private boolean isReview(String listName) {
        return normalized(listName).contains("review");
    }

    private boolean isDone(String listName) {
        return normalized(listName).contains("done");
    }

    private String normalized(String value) {
        return value == null ? "" : value.toLowerCase(Locale.ROOT);
    }

    private record ListInfo(String name, double position) {}

    private record CardData(String name, String listName, List<String> owners, List<String> labels, String type, String lastActivity, String url) {

        private boolean withoutOwner() {
            return owners.size() == 1 && WITHOUT_OWNER.equals(owners.get(0));
        }
    }

    private static class PersonCounter {

        private final AtomicInteger total = new AtomicInteger();
        private final AtomicInteger backlog = new AtomicInteger();
        private final AtomicInteger todo = new AtomicInteger();
        private final AtomicInteger doing = new AtomicInteger();
        private final AtomicInteger review = new AtomicInteger();
        private final AtomicInteger done = new AtomicInteger();
        private final Map<String, Integer> types = new HashMap<>();
    }
}
