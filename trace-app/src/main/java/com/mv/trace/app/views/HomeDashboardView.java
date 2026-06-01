package com.mv.trace.app.views;

import java.util.List;

public record HomeDashboardView(
        String sourceFile,
        String importedAt,
        boolean imported,
        List<SummaryCard> summaryCards,
        List<WorkflowColumn> workflowColumns,
        List<PersonWorkload> personWorkloads,
        List<CardTypeCount> cardTypeCounts,
        List<CardRow> cardRows,
        List<String> personFilters,
        List<String> listFilters,
        List<String> typeFilters
) {

    public record SummaryCard(String label, String value, String note, String severity) {}

    public record WorkflowColumn(String name, int total, String note, String severity) {}

    public record PersonWorkload(String name, int total, int backlog, int todo, int doing, int review, int done, String mainType) {}

    public record CardTypeCount(String name, int total, String note) {}

    public record CardRow(String name, String url, String listName, String members, String type, String labels, String lastActivity, boolean withoutOwner) {}
}
